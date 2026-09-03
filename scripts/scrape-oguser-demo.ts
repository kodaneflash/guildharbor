import { chromium, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const cacheDirectory = path.resolve(".demo-cache");
const userDataDirectory = path.join(cacheDirectory, "browser-profile");
const outputPath = path.join(cacheDirectory, "oguser-profiles.json");
const defaultForumUrl = "https://oguser.com/Forum-OG-Telegram-Usernames";
const maximumTarget = 100;
const maximumPages = 20;

const preferredAliases = [
  "Northstar", "Meridian", "Wavelength", "Pine", "Juniper", "Sable",
  "Ember", "Harbor", "Atlas", "Lumen", "Cedar", "Moss", "Vale", "Kite",
  "Echo", "Cinder", "Rowan", "Porter", "Avery", "Solstice", "Orbit",
  "Willow", "Quartz", "Mariner", "Briar", "Drift", "Summit", "Horizon",
  "Fable", "Nimbus", "Aurora", "Cobalt", "Maple", "Comet", "Osprey",
  "Ridge", "Violet", "Sterling", "Tide", "Grove", "Sierra", "Nova",
  "Beacon", "Meadow", "Flint", "Cascade", "Slate", "River", "Cove",
  "Aspen", "Coral", "Dawn", "Forest", "Garnet", "Iris", "Jasper",
  "Lagoon", "Moonrise", "Opal", "Prairie", "Reef", "Saffron", "Thistle",
  "Umber", "Vesper", "Winter", "Zephyr",
] as const;

const scrapedProfileSchema = z.object({
  alias: z.string().min(1),
  avatarUrl: z.string().url(),
  reputation: z.number().int().nonnegative().default(0),
  vouches: z.number().int().nonnegative().default(0),
  threads: z.number().int().nonnegative().default(0),
  posts: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  credits: z.number().int().nonnegative().default(0),
  joined: z.string().nullable().default(null),
  sourceFingerprint: z.string().default("legacy"),
});

const outputSchema = z.object({
  collectedAt: z.string(),
  profiles: z.array(scrapedProfileSchema),
});

type ScrapedProfile = z.infer<typeof scrapedProfileSchema>;

type ScrapeOptions = {
  append: boolean;
  delayMs: number;
  forumUrl: string;
  maxPages: number;
  target: number;
};

function parseIntegerFlag(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function parseOptions(argv: string[]): ScrapeOptions {
  const positional = argv.filter((argument) => !argument.startsWith("--"));
  const valueFor = (name: string) =>
    argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
  const requestedTarget = parseIntegerFlag(
    valueFor("target") ?? positional[1],
    30,
  );
  const requestedPages = parseIntegerFlag(valueFor("pages"), 10);
  const requestedDelay = parseIntegerFlag(valueFor("delay"), 900);

  return {
    append: !argv.includes("--fresh"),
    delayMs: Math.min(Math.max(requestedDelay, 500), 5_000),
    forumUrl: valueFor("forum") ?? positional[0] ?? defaultForumUrl,
    maxPages: Math.min(Math.max(requestedPages, 1), maximumPages),
    target: Math.min(Math.max(requestedTarget, 1), maximumTarget),
  };
}

function parseCount(value: string | null) {
  return Number(value?.replace(/[^0-9]/g, "") ?? "0") || 0;
}

function aliasForIndex(index: number) {
  return preferredAliases[index] ?? `HarborMember${String(index + 1).padStart(3, "0")}`;
}

function profileFingerprint(uid: string | null, profileUrl: string) {
  return createHash("sha256")
    .update(uid ?? new URL(profileUrl).pathname.toLocaleLowerCase())
    .digest("hex")
    .slice(0, 12);
}

async function readExistingProfiles(append: boolean) {
  if (!append) return [] satisfies ScrapedProfile[];
  try {
    const existing = outputSchema.parse(JSON.parse(await readFile(outputPath, "utf8")));
    return existing.profiles;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [] satisfies ScrapedProfile[];
    }
    if (error instanceof z.ZodError) {
      throw new Error("Existing scrape cache is invalid. Fix it or run with --fresh.");
    }
    throw new Error("Existing scrape cache could not be read safely.", {
      cause: error,
    });
  }
}

async function saveProfiles(profiles: ScrapedProfile[]) {
  await writeFile(
    outputPath,
    `${JSON.stringify({
      collectedAt: new Date().toISOString(),
      profiles,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function collectProfileUrls(
  page: Page,
  options: ScrapeOptions,
  desiredCandidates: number,
) {
  const profileUrls = new Set<string>();

  for (let pageNumber = 1; pageNumber <= options.maxPages; pageNumber += 1) {
    const pageUrl = new URL(options.forumUrl);
    if (pageNumber > 1) pageUrl.searchParams.set("page", String(pageNumber));
    await page.goto(pageUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.locator('a[href*="Thread-"]').first().waitFor({
      state: "visible",
      timeout: pageNumber === 1 ? 300_000 : 30_000,
    });

    const pageProfileUrls = await page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLTableRowElement>("tr")]
        .filter((row) => row.querySelector('a[href*="Thread-"]'));
      const urls: string[] = [];

      for (const row of rows) {
        const profileLink = [...row.querySelectorAll<HTMLAnchorElement>("a[href]")]
          .find((candidate) => {
            const href = new URL(candidate.href, window.location.href);
            const path = href.pathname.toLocaleLowerCase();
            return href.origin === window.location.origin
              && !path.includes("thread-")
              && !path.includes("forum-")
              && !path.endsWith("sticky.php")
              && !path.endsWith("upgrade.php");
          });
        if (profileLink) {
          const normalized = new URL(profileLink.href, window.location.href);
          normalized.search = "";
          normalized.hash = "";
          urls.push(normalized.toString());
        }
      }

      return [...new Set(urls)];
    });

    for (const profileUrl of pageProfileUrls) profileUrls.add(profileUrl);
    console.info(`Forum page ${pageNumber}: ${profileUrls.size} unique candidates`);
    if (profileUrls.size >= desiredCandidates) break;
    await page.waitForTimeout(options.delayMs);
  }

  return [...profileUrls];
}

async function extractProfile(page: Page, profileUrl: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(profileUrl, {
        timeout: 30_000,
        waitUntil: "domcontentloaded",
      });
      await page.locator(".profileheader").waitFor({
        state: "visible",
        timeout: 30_000,
      });

      return await page.evaluate(() => {
        const root = document.querySelector(".profileheader");
        const avatar = root?.querySelector<HTMLImageElement>(".profile_avatar img");
        const status = [...document.querySelectorAll<HTMLElement>(".statusblock")]
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "");
        const quarterStats = [...document.querySelectorAll<HTMLElement>(".flexquarter")]
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "");
        const profileRows = [...document.querySelectorAll<HTMLElement>(".col_row_profile.whole")]
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "");
        const findValue = (items: string[], label: string) =>
          items.find((value) => value.endsWith(` ${label}`))
            ?.replace(new RegExp(`\\s+${label}$`), "") ?? null;
        const findRow = (label: string) =>
          profileRows.find((value) => value.startsWith(`${label} `))
            ?.slice(label.length + 1) ?? null;

        return {
          avatarUrl: avatar?.dataset.src || avatar?.src || null,
          credits: findValue(quarterStats, "Credits"),
          joined: findRow("Join Date"),
          likes: findValue(quarterStats, "Likes"),
          posts: findValue(quarterStats, "Posts"),
          reputation: findValue(status, "Reputation"),
          threads: findValue(quarterStats, "Threads"),
          uid: findRow("UID"),
          vouches: findValue(status, "Vouches"),
        };
      });
    } catch {
      if (attempt === 3) {
        console.warn(`Skipped an unavailable profile after ${attempt} attempts: ${profileUrl}`);
        return null;
      }
      await page.waitForTimeout(attempt * 1_000);
    }
  }

  return null;
}

const options = parseOptions(process.argv.slice(2));
await mkdir(cacheDirectory, { recursive: true });
const existingProfiles = await readExistingProfiles(options.append);
const existingFingerprints = new Set(
  existingProfiles
    .map((profile) => profile.sourceFingerprint)
    .filter((fingerprint) => fingerprint !== "legacy"),
);
const existingAvatarUrls = new Set(
  existingProfiles.map((profile) => profile.avatarUrl),
);
const context = await chromium.launchPersistentContext(userDataDirectory, {
  headless: process.env.SCRAPER_HEADLESS === "true",
  viewport: { width: 1440, height: 1000 },
});
const page = context.pages()[0] ?? await context.newPage();

try {
  console.info(
    `Collecting ${options.target} additional valid profiles from up to ${options.maxPages} forum pages.`,
  );
  console.info(
    "If authentication or a Cloudflare check appears, complete it in the opened browser.",
  );

  const candidateUrls = await collectProfileUrls(
    page,
    options,
    Math.min(options.target * 3, 150),
  );
  const profiles = [...existingProfiles];
  let added = 0;

  for (const profileUrl of candidateUrls) {
    if (added >= options.target) break;
    const profile = await extractProfile(page, profileUrl);
    if (!profile?.avatarUrl) continue;
    if (
      profile.avatarUrl.includes("/default_avatar.")
      || existingAvatarUrls.has(profile.avatarUrl)
    ) {
      continue;
    }

    const fingerprint = profileFingerprint(profile.uid, profileUrl);
    if (existingFingerprints.has(fingerprint)) continue;

    const scrapedProfile = scrapedProfileSchema.parse({
      alias: aliasForIndex(profiles.length),
      avatarUrl: profile.avatarUrl,
      credits: parseCount(profile.credits),
      joined: profile.joined,
      likes: parseCount(profile.likes),
      posts: parseCount(profile.posts),
      reputation: parseCount(profile.reputation),
      sourceFingerprint: fingerprint,
      threads: parseCount(profile.threads),
      vouches: parseCount(profile.vouches),
    });
    profiles.push(scrapedProfile);
    existingAvatarUrls.add(scrapedProfile.avatarUrl);
    existingFingerprints.add(scrapedProfile.sourceFingerprint);
    added += 1;
    await saveProfiles(profiles);
    console.info(`Accepted ${added}/${options.target}: ${scrapedProfile.alias}`);
    await page.waitForTimeout(options.delayMs);
  }

  console.info(
    `Saved ${profiles.length} total pseudonymized profiles (${added} added) to ${outputPath}`,
  );
  if (added < options.target) {
    console.warn(
      `Only ${added} new valid profiles were available. Increase --pages and run again.`,
    );
  }
} finally {
  await context.close();
}
