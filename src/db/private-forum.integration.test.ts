// @vitest-environment node
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import MembersPage from "@/app/(product)/members/page";
import { createHash, createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const context = vi.hoisted(() => ({
  db: null as unknown,
  headers: new Headers(),
  otps: new Map<string, string>(),
  storageEnabled: false,
  mode: "private" as "public" | "private",
  objects: new Map<string, Uint8Array>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    get COMMUNITY_ACCESS_MODE() { return context.mode; },
    DATABASE_URL: "postgresql://test",
    BETTER_AUTH_SECRET: "test-secret-is-only-used-in-isolated-tests-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    R2_BUCKET: "private-test",
  },
  isDatabaseConfigured: true,
  isGoogleConfigured: false,
  isAppleConfigured: false,
  get isR2Configured() {
    return context.storageEnabled;
  },
}));
vi.mock("@/db/client", () => ({
  createReadDatabase: () =>
    new Proxy(
      {},
      {
        get: (_, key) => {
          const db = context.db as Record<PropertyKey, unknown>;
          const value = db[key];
          return typeof value === "function" ? value.bind(db) : value;
        },
      },
    ),
}));
vi.mock("@/db/transaction", () => ({
  withTransaction: (
    operation: Parameters<ReturnType<typeof drizzle>["transaction"]>[0],
  ) => (context.db as ReturnType<typeof drizzle>).transaction(operation),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async () => "https://storage.example.test/upload",
}));
vi.mock("@/lib/storage", () => ({
  createObjectStorageClient: () => ({
    send: async (command: {
      constructor: { name: string };
      input: { Key: string; Body?: Uint8Array };
    }) => {
      const key = command.input.Key;
      if (command.constructor.name === "PutObjectCommand") {
        context.objects.set(key, command.input.Body!);
        return {};
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        context.objects.delete(key);
        return {};
      }
      const bytes = context.objects.get(key);
      if (!bytes) throw new Error("Missing test object");
      return {
        ContentLength: bytes.length,
        Body: {
          transformToByteArray: async () => bytes,
          transformToWebStream: () =>
            new ReadableStream({
              start(controller) {
                controller.enqueue(bytes);
                controller.close();
              },
            }),
        },
      };
    },
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendOtpEmail: async ({ email, otp }: { email: string; otp: string }) => {
    context.otps.set(email, otp);
  },
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));

import { auth } from "@/lib/auth";
import { isApprovedMember } from "@/lib/membership";
import { createThreadAction } from "@/app/(product)/threads/new/actions";
import {
  getAccess,
  requireMember,
  requirePermission,
  canAccessForum,
} from "@/lib/session";
import {
  communityThreads,
  findThread,
  threadPosts,
} from "@/db/queries/community";
import { createThread, replyToThread } from "@/domains/thread/thread-service";
import { reviewRegistration } from "@/app/(product)/admin/registrations/actions";
import { GET as feed } from "@/app/feeds/forums/[feed]/route";
import { GET as file } from "@/app/api/files/[id]/route";
import { POST as signUpload } from "@/app/api/uploads/sign/route";
import { POST as completeUpload } from "@/app/api/uploads/complete/route";
import { POST as viewThread } from "@/app/api/thread-views/route";

let pg: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
let admin: { id: string; cookie: string };
let member: { id: string; cookie: string };
let forumId: number;
let created: { id: number; slug: string };
const password = "correct-test-password-123";
let authRequestIndex = 0;
async function authRequest(path: string, body: object, cookie = "") {
  const response = await auth!.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-forwarded-for": `192.0.2.${++authRequestIndex}`,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    }),
  );
  const json = await response.json();
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { response, json, cookie: cookies };
}
async function register(username: string) {
  const email = `${username}@example.test`;
  const signup = await authRequest("/sign-up/email", {
    username,
    name: username,
    email,
    password,
  });
  expect(signup.response.status, JSON.stringify(signup.json)).toBe(200);
  const verify = await authRequest("/email-otp/verify-email", {
    email,
    otp: context.otps.get(email),
  });
  expect(verify.response.status, JSON.stringify(verify.json)).toBe(200);
  const login = await authRequest("/sign-in/email", { email, password });
  expect(login.response.status, JSON.stringify(login.json)).toBe(200);
  return { id: signup.json.user.id as string, cookie: login.cookie };
}
function asUser(cookie = "") {
  context.headers = new Headers({ Cookie: cookie });
}
function request(path: string, body?: object) {
  return new Request(`http://localhost:3000${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: "http://localhost:3000",
      "x-forwarded-for": `192.0.2.${++authRequestIndex}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { citext, pg_trgm } });
  database = drizzle(pg, { schema });
  context.db = database;
  for (const migration of ["0000_slow_solo", "0001_aspiring_black_panther"])
    await pg.exec(await readFile(`drizzle/${migration}.sql`, "utf8"));
  // Upgrade test: real content written with the old marketplace thread enum must survive.
  await pg.exec(`INSERT INTO users (id,name,email,email_verified,username,account_status) VALUES ('legacy','Legacy','legacy@example.test',true,'legacy','active');
    INSERT INTO categories (slug,title) VALUES ('community','Community');
    INSERT INTO forums (category_id,slug,title) SELECT id,'general','General' FROM categories;
    INSERT INTO threads (forum_id,creator_id,slug,title,type) SELECT id,'legacy','legacy-thread','Existing member-authored content','selling' FROM forums;
    INSERT INTO posts (thread_id,author_id,content,plain_text) SELECT id,'legacy','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Preserve this post"}]}]}','Preserve this post' FROM threads;`);
  await pg.exec(
    `BEGIN; ${await readFile("drizzle/0002_private_forum.sql", "utf8")} COMMIT;`,
  );
  for (const migration of ["0003_profile_preferences", "0004_commerce_foundation", "0005_notification_delivery", "0006_unfunded_deals_support", "0007_resource_file_scanning", "0008_deal_request_version"]) await pg.exec(await readFile(`drizzle/${migration}.sql`, "utf8"));
  // auth is initialized at import; its mocked adapter accesses this database lazily.
  admin = await register("operator");
  member = await register("applicant");
  const [role] = await database
    .insert(schema.roles)
    .values({
      key: "admin",
      name: "Administrator",
      permissions: ["admin.manage"],
    })
    .returning();
  await database
    .insert(schema.userRoles)
    .values({ userId: admin.id, roleId: role.id });
  await database
    .update(schema.users)
    .set({ membershipStatus: "approved" })
    .where(eq(schema.users.id, admin.id));
  forumId = (await database.select().from(schema.forums))[0].id;
}, 30000);
afterAll(async () => {
  await pg?.close();
});

describe.sequential(
  "private forum with migrated PostgreSQL and real Better Auth",
  () => {
    it("preserves existing posts, converts listing thread types, and defaults existing users to pending", async () => {
      const [row] = await database
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.creatorId, "legacy"));
      expect(row.type).toBe("discussion");
      expect(row.title).toBe("Existing member-authored content");
      expect(
        (
          await database
            .select()
            .from(schema.posts)
            .where(eq(schema.posts.authorId, "legacy"))
        )[0].plainText,
      ).toBe("Preserve this post");
      expect(
        (
          await database
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, "legacy"))
        )[0].membershipStatus,
      ).toBe("pending");
      expect(
        (
          await pg.query<{ name: string | null }>(
            "select to_regclass('marketplace_listings')::text as name",
          )
        ).rows[0].name,
      ).toBeNull();
    });
    it("provisions a profile and member role atomically without granting access after email verification", async () => {
      asUser(member.cookie);
      expect((await getAccess()).allowed).toBe(false);
      await expect(requireMember()).rejects.toThrow("FORBIDDEN");
      expect(
        await database
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, member.id)),
      ).toHaveLength(1);
      expect(
        await database
          .select()
          .from(schema.userRoles)
          .where(eq(schema.userRoles.userId, member.id)),
      ).toHaveLength(1);
    });
    it("lists only approved active members and ignores client-supplied approval", async () => {
    asUser(admin.cookie);
    const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("operator"); expect(html).not.toContain("applicant");
    const result = await authRequest("/sign-up/email", { email: "tampered@example.test", name: "Tampered", username: "tampered", password, membershipStatus: "approved", accountStatus: "active" });
    expect(result.response.status).toBe(200);
    const [user] = await database.select().from(schema.users).where(eq(schema.users.id, result.json.user.id));
    expect(user.membershipStatus).toBe("pending"); expect(user.accountStatus).toBe("pending_email");
  });
  it.each(["public", "private"] as const)("denies guest reads, feed, files, uploads, views and thread creation in %s mode", async (mode) => {
      context.mode = mode;
      asUser();
      await expect(createThreadAction({ error: "" }, new FormData())).rejects.toThrow("FORBIDDEN");
      await expect(communityThreads()).rejects.toThrow("FORBIDDEN");
      await expect(threadPosts(1)).rejects.toThrow("FORBIDDEN");
      await expect(
        createThread({
          actorId: member.id,
          forumId,
          title: "Unauthorized thread",
          type: "discussion",
          content: { type: "doc", content: [] },
        }),
      ).rejects.toThrow("FORBIDDEN");
      expect(
        (
          await feed(request("/feeds/forums/general.xml"), {
            params: Promise.resolve({ feed: "general.xml" }),
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await file(request("/api/files/anything"), {
            params: Promise.resolve({ id: "anything" }),
          })
        ).status,
      ).toBe(401);
      expect((await signUpload(request("/api/uploads/sign", {}))).status).toBe(
        401,
      );
      expect(
        (await completeUpload(request("/api/uploads/complete", {}))).status,
      ).toBe(401);
      expect(
        (await viewThread(request("/api/thread-views", { threadId: 1 })))
          .status,
      ).toBe(401);
    });
    it("denies pending users at API and administrator action boundaries", async () => {
      asUser(member.cookie);
      expect((await signUpload(request("/api/uploads/sign", {}))).status).toBe(
        403,
      );
      expect(
        (
          await feed(request("/feeds/forums/general.xml"), {
            params: Promise.resolve({ feed: "general.xml" }),
          })
        ).status,
      ).toBe(403);
      const form = new FormData();
      form.set("userId", member.id);
      form.set("decision", "approved");
      await expect(reviewRegistration(form)).rejects.toThrow("FORBIDDEN");
    });
    it("grants pending members public access without persisting approval and revokes it in private mode", async () => {
      try {
        context.mode = "public";
        asUser(member.cookie);
        expect((await getAccess()).allowed).toBe(true);
        const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
        expect(html).toContain("applicant");
        const thread = await createThread({
          actorId: member.id, forumId, title: "Public mode member thread", type: "discussion",
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Persist public member content" }] }] },
        });
        await replyToThread(thread.id, "Public member reply");
        expect(await findThread(thread.id)).toBeTruthy();
        expect((await database.select().from(schema.users).where(eq(schema.users.id, member.id)))[0].membershipStatus).toBe("pending");
        await expect(requirePermission("admin.manage")).rejects.toThrow("FORBIDDEN");
        context.mode = "private";
        expect((await getAccess()).allowed).toBe(false);
        await expect(findThread(thread.id)).rejects.toThrow("FORBIDDEN");
        asUser(admin.cookie);
        expect((await getAccess()).allowed).toBe(true);
        expect(await findThread(thread.id)).toBeTruthy();
      } finally { context.mode = "private"; }
    });
    it("lets an administrator approve an application, records the review, and updates an existing session immediately", async () => {
      asUser(admin.cookie);
      const form = new FormData();
      form.set("userId", member.id);
      form.set("decision", "approved");
      await reviewRegistration(form);
      expect(
        await database
          .select()
          .from(schema.moderationActions)
          .where(eq(schema.moderationActions.subjectUserId, member.id)),
      ).toHaveLength(1);
      asUser(member.cookie);
      expect((await getAccess()).allowed).toBe(true);
      await expect(requirePermission("admin.manage")).rejects.toThrow(
        "FORBIDDEN",
      );
    });
    it("persists a newly published thread and replies through independent reads", async () => {
      asUser(member.cookie);
      created = await createThread({
        actorId: member.id,
        forumId,
        title: "Actual stored discussion",
        type: "discussion",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Unique persisted first post." }],
            },
          ],
        },
      });
      expect((await findThread(created.id))?.title).toBe(
        "Actual stored discussion",
      );
      expect((await threadPosts(created.id))[0].content).toMatchObject({
        content: [{ content: [{ text: "Unique persisted first post." }] }],
      });
      await replyToThread(created.id, "A real persisted reply.");
      expect(await threadPosts(created.id)).toHaveLength(2);
      expect((await findThread(created.id))?.replyCount).toBe(1);
      expect((await communityThreads({ query: "persisted reply" }))[0].id).toBe(
        created.id,
      );
    });
    it("does not reveal private subforum content in listing, search, thread detail or feeds", async () => {
      const [privateForum] = await database
        .insert(schema.forums)
        .values({
          categoryId: 1,
          slug: "staff-room",
          title: "Staff room",
          isPrivate: true,
        })
        .returning();
      asUser(admin.cookie);
      const privateThread = await createThread({
        actorId: admin.id,
        forumId: privateForum.id,
        title: "Private staff discussion",
        type: "discussion",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Staff secret." }],
            },
          ],
        },
      });
      asUser(member.cookie);
      expect(await canAccessForum(privateForum.id)).toBe(false);
      expect(await findThread(privateThread.id)).toBeNull();
      expect(await communityThreads({ query: "Staff secret" })).toHaveLength(0);
      expect(
        (
          await feed(request("/feeds/forums/staff-room.xml"), {
            params: Promise.resolve({ feed: "staff-room.xml" }),
          })
        ).status,
      ).toBe(404);
    });
    it("rejects reserved, missing and competing usernames at API and database boundaries", async () => {
      expect(
        (
          await authRequest("/sign-up/email", {
            email: "missing@example.test",
            name: "Missing",
            password,
          })
        ).response.status,
      ).toBe(400);
      expect(
        (await authRequest("/is-username-available", { username: "ADMIN" }))
          .json.available,
      ).not.toBe(true);
      expect(
        (await authRequest("/is-username-available", { username: "ApPlIcAnT" }))
          .json.available,
      ).toBe(false);
      const competition = await Promise.allSettled(
        ["RaceName", "racename"].map((username, index) =>
          database.insert(schema.users).values({
            id: `race-${index}`,
            name: username,
            username,
            email: `race${index}@example.test`,
          }),
        ),
      );
      expect(
        competition.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        (
          await database
            .select()
            .from(schema.users)
            .where(eq(schema.users.username, "racename"))
        )[0].username,
      ).toBe("racename");
      await expect(
        database.insert(schema.users).values({
          id: "reserved",
          name: "Reserved",
          username: "ADMIN",
          email: "reserved@example.test",
        }),
      ).rejects.toThrow();
    });
    it("keeps social onboarding pending after selecting a username", async () => {
      await database.insert(schema.users).values({
        id: "social-user",
        name: "Social User",
        email: "social@example.test",
        emailVerified: true,
        accountStatus: "pending_username",
      });
      const authContext = await auth!.$context;
      const socialSession =
        await authContext.internalAdapter.createSession("social-user");
      // A real signed cookie is obtained through the Better Auth session API below via bearer-free internal calls.
      await authContext.internalAdapter.updateUser("social-user", {
        username: "socialmember",
      });
      const [social] = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, "social-user"));
      expect(social.accountStatus).toBe("active");
      expect(social.membershipStatus).toBe("pending");
      expect(socialSession.userId).toBe("social-user");
      expect(isApprovedMember({ ...social, username: null }, "public")).toBe(false);
      expect(isApprovedMember(social, "public")).toBe(true);
      expect(isApprovedMember(social, "private")).toBe(false);
    });
    it.each(["public", "private"] as const)("validates, persists and privately serves avatars in %s mode", async (mode) => {
      context.mode = mode;
      await database.update(schema.users).set({ membershipStatus: mode === "public" ? "pending" : "approved" }).where(eq(schema.users.id, member.id));
      try {
      context.storageEnabled = true;
      asUser(member.cookie);
      const image = await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#123456" },
      })
        .png()
        .toBuffer();
      const signed = await signUpload(
        request("/api/uploads/sign", {
          purpose: "avatar",
          fileName: "avatar.png",
          size: image.length,
          mediaType: "image/png",
          checksum: createHash("sha256").update(image).digest("hex"),
        }),
      );
      expect(signed.status).toBe(200);
      const upload = await signed.json();
      const [attachment] = await database
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, upload.attachmentId));
      context.objects.set(attachment.storageKey, image);
      asUser(admin.cookie);
      expect(
        (
          await completeUpload(
            request("/api/uploads/complete", { attachmentId: attachment.id }),
          )
        ).status,
      ).toBe(404);
      asUser(member.cookie);
      const completed = await completeUpload(
        request("/api/uploads/complete", { attachmentId: attachment.id }),
      );
      expect(completed.status).toBe(200);
      const { avatarUrl } = await completed.json();
      expect(
        (
          await database
            .select()
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, member.id))
        )[0].avatarUrl,
      ).toBe(avatarUrl);
      const fetched = await file(request(avatarUrl), {
        params: Promise.resolve({ id: attachment.id }),
      });
      expect(fetched.status).toBe(200);
      expect(fetched.headers.get("cache-control")).toContain("no-store");
      expect(
        (await sharp(Buffer.from(await fetched.arrayBuffer())).metadata())
          .format,
      ).toBe("webp");
      asUser();
      expect(
        (
          await file(request(avatarUrl), {
            params: Promise.resolve({ id: attachment.id }),
          })
        ).status,
      ).toBe(401);
      asUser(member.cookie);
      const badSign = await signUpload(
        request("/api/uploads/sign", {
          purpose: "avatar",
          fileName: "invalid.png",
          size: 4,
          mediaType: "image/png",
          checksum: "0".repeat(64),
        }),
      );
      const badId = (await badSign.json()).attachmentId;
      const [bad] = await database
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, badId));
      context.objects.set(bad.storageKey, new Uint8Array([1, 2, 3, 4]));
      expect(
        (
          await completeUpload(
            request("/api/uploads/complete", { attachmentId: badId }),
          )
        ).status,
      ).toBe(422);
      expect(
        (
          await database
            .select()
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, member.id))
        )[0].avatarUrl,
      ).toBe(avatarUrl);
      context.storageEnabled = false;
      } finally {
        context.mode = "private";
        await database.update(schema.users).set({ membershipStatus: "approved" }).where(eq(schema.users.id, member.id));
      }
    });
    it("changes passwords through Better Auth and rejects the old password", async () => {
      const changed = await authRequest(
        "/change-password",
        {
          currentPassword: password,
          newPassword: "new-correct-password-456",
          revokeOtherSessions: true,
        },
        member.cookie,
      );
      expect(changed.response.status, JSON.stringify(changed.json)).toBe(200);
      expect(
        (
          await authRequest("/sign-in/email", {
            email: "applicant@example.test",
            password,
          })
        ).response.status,
      ).toBe(401);
      const login = await authRequest("/sign-in/email", {
        email: "applicant@example.test",
        password: "new-correct-password-456",
      });
      expect(login.response.status).toBe(200);
      member.cookie = login.cookie;
    });
    it("enrolls TOTP only after a correct code and requires it on subsequent password sign-in", async () => {
      const enrollment = await authRequest(
        "/two-factor/enable",
        { password: "new-correct-password-456" },
        member.cookie,
      );
      expect(enrollment.response.status, JSON.stringify(enrollment.json)).toBe(
        200,
      );
      const secret = new URL(enrollment.json.totpURI).searchParams.get(
        "secret",
      )!;
      const bits = [...secret]
        .map((char) =>
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
            .indexOf(char)
            .toString(2)
            .padStart(5, "0"),
        )
        .join("");
      const bytes = Buffer.from(
        (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
      );
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
      const hash = createHmac("sha1", bytes).update(counter).digest();
      const offset = hash[19] & 15;
      const code = String(
        (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000,
      ).padStart(6, "0");
      expect(
        (
          await database
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, member.id))
        )[0].twoFactorEnabled,
      ).toBe(false);
      const verified = await authRequest(
        "/two-factor/verify-totp",
        { code },
        member.cookie,
      );
      expect(verified.response.status, JSON.stringify(verified.json)).toBe(200);
      if (verified.cookie) member.cookie = verified.cookie;
      expect(
        (
          await database
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, member.id))
        )[0].twoFactorEnabled,
      ).toBe(true);
      const login = await authRequest("/sign-in/email", {
        email: "applicant@example.test",
        password: "new-correct-password-456",
      });
      expect(login.json.twoFactorRedirect).toBe(true);
      expect(
        (
          await authRequest("/sign-in/email-otp", {
            email: "applicant@example.test",
            otp: "123456",
          })
        ).response.status,
      ).toBe(403);
    });
    it("rejects applications without allowing later email/user updates to restore access", async () => {
      const rejected = await register("declined");
      asUser(admin.cookie);
      const form = new FormData();
      form.set("userId", rejected.id);
      form.set("decision", "rejected");
      await reviewRegistration(form);
      await (
        await auth!.$context
      ).internalAdapter.updateUser(rejected.id, { name: "Updated" });
      asUser(rejected.cookie);
      expect((await getAccess()).allowed).toBe(false);
      await expect(findThread(created.id)).rejects.toThrow("FORBIDDEN");
      expect(
        (
          await file(request("/api/files/anything"), {
            params: Promise.resolve({ id: "anything" }),
          })
        ).status,
      ).toBe(403);
    });
    it.each(["public", "private"] as const)("denies account restrictions in %s mode with a live session", async (mode) => {
      context.mode = mode;
      try {
        asUser(member.cookie);
        for (const accountStatus of ["restricted", "suspended", "banned", "deleted"] as const) {
          await database.update(schema.users).set({ accountStatus }).where(eq(schema.users.id, member.id));
          expect((await getAccess()).allowed).toBe(false);
          await expect(communityThreads()).rejects.toThrow("FORBIDDEN");
          expect((await file(request("/api/files/anything"), { params: Promise.resolve({ id: "anything" }) })).status).toBe(403);
        }
      } finally {
        await database.update(schema.users).set({ accountStatus: "active" }).where(eq(schema.users.id, member.id));
        context.mode = "private";
      }
    });
    it("denies a previously approved session immediately after access is removed", async () => {
      await database
        .update(schema.users)
        .set({ membershipStatus: "rejected" })
        .where(eq(schema.users.id, member.id));
      asUser(member.cookie);
      expect((await getAccess()).allowed).toBe(false);
      await expect(
        replyToThread(created.id, "Must not persist"),
      ).rejects.toThrow("FORBIDDEN");
      expect(
        await database
          .select()
          .from(schema.posts)
          .where(
            and(
              eq(schema.posts.threadId, created.id),
              eq(schema.posts.plainText, "Must not persist"),
            ),
          ),
      ).toHaveLength(0);
    });
  },
);
