import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  demoCommunityMembers,
  type DemoCommunityMember,
} from "@/data/demo-community";

const scrapedProfileSchema = z.object({
  alias: z.string().regex(/^[A-Za-z][A-Za-z0-9]{1,29}$/),
  avatarUrl: z.string().url(),
  reputation: z.number().int().nonnegative().default(0),
  vouches: z.number().int().nonnegative().default(0),
  threads: z.number().int().nonnegative().default(0),
  posts: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  credits: z.number().int().nonnegative().default(0),
  joined: z.string().nullable().default(null),
}).passthrough();

const scrapeOutputSchema = z.object({
  profiles: z.array(scrapedProfileSchema),
}).passthrough();

const lawfulThreadTemplates = [
  {
    forumSlug: "digital-goods",
    title: "Original interface icon collection",
    type: "selling",
    summary: "An original set of editable interface icons with a clear commercial license and accessible variants.",
  },
  {
    forumSlug: "services",
    title: "React performance and accessibility review",
    type: "service",
    summary: "A focused product review covering rendering, interaction responsiveness, keyboard access, and practical remediation.",
  },
  {
    forumSlug: "domains",
    title: "Brandable domain portfolio with ownership records",
    type: "selling",
    summary: "A curated selection of lawfully owned domains with registrar proof and a documented transfer process.",
  },
  {
    forumSlug: "general",
    title: "How do you document a reliable project handoff?",
    type: "discussion",
    summary: "A community discussion about scope, acceptance criteria, source files, delivery notes, and maintainable handoffs.",
  },
  {
    forumSlug: "digital-goods",
    title: "Original presentation and document templates",
    type: "selling",
    summary: "A reusable collection of original presentation and document templates with editable source files.",
  },
  {
    forumSlug: "services",
    title: "TypeScript architecture consultation",
    type: "service",
    summary: "A structured consultation covering boundaries, type design, build performance, testing, and migration priorities.",
  },
] as const satisfies ReadonlyArray<DemoCommunityMember["thread"]>;

function normalizedJoinDate(value: string | null) {
  const match = value?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "2023-01-01";
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

function memberId(alias: string) {
  return `demo-member-${alias.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export async function loadScrapedDemoMembers() {
  let scrapedProfiles: z.infer<typeof scrapedProfileSchema>[] = [];
  try {
    const source = JSON.parse(
      await readFile(path.resolve(".demo-cache/oguser-profiles.json"), "utf8"),
    );
    scrapedProfiles = scrapeOutputSchema.parse(source).profiles;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return demoCommunityMembers;
    }
    throw new Error("Demo scrape cache could not be validated.", { cause: error });
  }

  const existingAliases = new Set(
    demoCommunityMembers.map((member) => member.username.toLocaleLowerCase()),
  );
  const additionalMembers = scrapedProfiles
    .filter((profile) => !existingAliases.has(profile.alias.toLocaleLowerCase()))
    .map((profile, index): DemoCommunityMember => {
      const template = lawfulThreadTemplates[index % lawfulThreadTemplates.length];
      return {
        id: memberId(profile.alias),
        username: profile.alias,
        displayName: profile.alias,
        avatarUrl: `/api/demo-avatars/${profile.alias.toLocaleLowerCase()}.webp`,
        reputation: profile.reputation,
        vouches: profile.vouches,
        sourceThreadCount: profile.threads,
        sourcePostCount: profile.posts,
        likes: profile.likes,
        credits: profile.credits,
        joinedAt: normalizedJoinDate(profile.joined),
        thread: {
          ...template,
          title: `${template.title} — ${profile.alias}`,
        },
      };
    });

  return [...demoCommunityMembers, ...additionalMembers];
}
