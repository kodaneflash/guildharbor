import type { ProfileSummary, ThreadListItem } from "@/lib/domain-types";

export type DemoCommunityMember = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  reputation: number;
  vouches: number;
  sourceThreadCount: number;
  sourcePostCount: number;
  likes: number;
  credits: number;
  joinedAt: string;
  thread: {
    forumSlug: "digital-goods" | "domains" | "general" | "services";
    title: string;
    type: "discussion" | "selling" | "service";
    summary: string;
  };
};

export const demoCommunityMembers: DemoCommunityMember[] = [
  {
    id: "demo-member-northstar",
    username: "Northstar",
    displayName: "Northstar",
    avatarUrl: "/api/demo-avatars/northstar.webp",
    reputation: 311,
    vouches: 48,
    sourceThreadCount: 29,
    sourcePostCount: 1023,
    likes: 364,
    credits: 46101,
    joinedAt: "2024-12-17",
    thread: {
      forumSlug: "digital-goods",
      title: "Complete brand identity starter kit for indie teams",
      type: "selling",
      summary: "An original, licensed collection of logo templates, typography guidance, and practical brand-system files.",
    },
  },
  {
    id: "demo-member-meridian",
    username: "Meridian",
    displayName: "Meridian",
    avatarUrl: "/api/demo-avatars/meridian.webp",
    reputation: 2245,
    vouches: 319,
    sourceThreadCount: 7,
    sourcePostCount: 1760,
    likes: 564,
    credits: 1598501,
    joinedAt: "2020-12-11",
    thread: {
      forumSlug: "services",
      title: "Accessibility audit and remediation for React products",
      type: "service",
      summary: "A focused accessibility review with keyboard, focus, semantics, contrast, and implementation guidance.",
    },
  },
  {
    id: "demo-member-wavelength",
    username: "Wavelength",
    displayName: "Wavelength",
    avatarUrl: "/api/demo-avatars/wavelength.webp",
    reputation: 2603,
    vouches: 624,
    sourceThreadCount: 7,
    sourcePostCount: 808,
    likes: 676,
    credits: 27539,
    joinedAt: "2017-04-29",
    thread: {
      forumSlug: "digital-goods",
      title: "Original ambient sound library for games and podcasts",
      type: "selling",
      summary: "A royalty-cleared library of original ambience, interface sounds, and seamless environmental loops.",
    },
  },
  {
    id: "demo-member-pine",
    username: "Pine",
    displayName: "Pine",
    avatarUrl: "/api/demo-avatars/pine.webp",
    reputation: 2869,
    vouches: 727,
    sourceThreadCount: 17,
    sourcePostCount: 1578,
    likes: 4104,
    credits: 10,
    joinedAt: "2017-04-29",
    thread: {
      forumSlug: "domains",
      title: "Short brandable domains with documented ownership",
      type: "selling",
      summary: "A small portfolio of lawfully owned brandable domains with registrar proof and a clear transfer process.",
    },
  },
  {
    id: "demo-member-juniper",
    username: "Juniper",
    displayName: "Juniper",
    avatarUrl: "/api/demo-avatars/juniper.webp",
    reputation: 4435,
    vouches: 623,
    sourceThreadCount: 152,
    sourcePostCount: 25730,
    likes: 8842,
    credits: 31800,
    joinedAt: "2017-05-06",
    thread: {
      forumSlug: "services",
      title: "Product strategy sessions for early-stage software teams",
      type: "service",
      summary: "Structured product strategy sessions covering positioning, scope, prioritization, and measurable launch goals.",
    },
  },
  {
    id: "demo-member-sable",
    username: "Sable",
    displayName: "Sable",
    avatarUrl: "/api/demo-avatars/sable.webp",
    reputation: 220,
    vouches: 78,
    sourceThreadCount: 27,
    sourcePostCount: 14,
    likes: 127,
    credits: 21515,
    joinedAt: "2024-04-12",
    thread: {
      forumSlug: "digital-goods",
      title: "Hand-drawn mobile illustration collection",
      type: "selling",
      summary: "An original set of editable illustrations with commercial licensing and accessible color variants.",
    },
  },
  {
    id: "demo-member-ember",
    username: "Ember",
    displayName: "Ember",
    avatarUrl: "/api/demo-avatars/ember.webp",
    reputation: 1358,
    vouches: 300,
    sourceThreadCount: 15,
    sourcePostCount: 501,
    likes: 490,
    credits: 34,
    joinedAt: "2022-03-10",
    thread: {
      forumSlug: "digital-goods",
      title: "Modular logo system and social brand templates",
      type: "selling",
      summary: "A flexible original logo system with editable source files and reusable social templates.",
    },
  },
  {
    id: "demo-member-harbor",
    username: "Harbor",
    displayName: "Harbor",
    avatarUrl: "/api/demo-avatars/harbor.webp",
    reputation: 9340,
    vouches: 2924,
    sourceThreadCount: 23,
    sourcePostCount: 3215,
    likes: 6370,
    credits: 252842,
    joinedAt: "2017-04-29",
    thread: {
      forumSlug: "general",
      title: "Marketplace safety checklist for buyers and sellers",
      type: "discussion",
      summary: "A practical checklist for verifying ownership, defining scope, documenting delivery, and reporting concerns.",
    },
  },
  {
    id: "demo-member-atlas",
    username: "Atlas",
    displayName: "Atlas",
    avatarUrl: "/api/demo-avatars/atlas.webp",
    reputation: 3096,
    vouches: 790,
    sourceThreadCount: 28,
    sourcePostCount: 1790,
    likes: 1195,
    credits: 3917002,
    joinedAt: "2017-04-29",
    thread: {
      forumSlug: "services",
      title: "Technical writing and content design for developer tools",
      type: "service",
      summary: "Clear product documentation, onboarding copy, and content-system work for technical products.",
    },
  },
  {
    id: "demo-member-lumen",
    username: "Lumen",
    displayName: "Lumen",
    avatarUrl: "/api/demo-avatars/lumen.webp",
    reputation: 435,
    vouches: 88,
    sourceThreadCount: 13,
    sourcePostCount: 18,
    likes: 64,
    credits: 25056,
    joinedAt: "2025-02-26",
    thread: {
      forumSlug: "services",
      title: "TypeScript architecture review for growing codebases",
      type: "service",
      summary: "A maintainability and performance review covering module boundaries, types, builds, and migration priorities.",
    },
  },
];

const profileBadges: ProfileSummary["badges"] = [
  { label: "Verified member", icon: "BadgeCheck", tone: "cyan" },
  { label: "Top seller", icon: "Trophy", tone: "yellow" },
  { label: "Helpful", icon: "HeartHandshake", tone: "trust" },
];

export function profileFromDemoMember(member: DemoCommunityMember): ProfileSummary {
  const joined = new Date(`${member.joinedAt}T00:00:00Z`);
  const years = Math.max(1, new Date().getUTCFullYear() - joined.getUTCFullYear());

  return {
    username: member.username,
    displayName: member.displayName,
    tagline: "GuildHarbor demo community member",
    avatarSeed: member.username.slice(0, 2),
    avatarUrl: member.avatarUrl,
    initials: member.username.slice(0, 2).toUpperCase(),
    joined: joined.toLocaleDateString("en-US", { timeZone: "UTC" }),
    lastSeen: "Last seen recently",
    uid: member.id.replace("demo-member-", "").toUpperCase(),
    reputation: member.reputation,
    vouches: { positive: member.vouches, neutral: 0, negative: 0 },
    threads: member.sourceThreadCount,
    posts: member.sourcePostCount,
    likes: member.likes,
    credits: member.credits,
    years,
    badges: profileBadges,
    groups: [
      { name: "Verified", subtitle: "Established demo marketplace member", tone: "cyan" },
      { name: "Contributor", subtitle: "Active community participant", tone: "trust" },
    ],
    listings: [
      { title: member.thread.title, category: member.thread.forumSlug, status: member.thread.type === "discussion" ? "Guide" : "Verified" },
    ],
    activity: [
      { title: member.thread.title, detail: "Recently active", href: `/members/${member.username}/threads` },
      { title: "Received positive community feedback", detail: "This week", href: `/members/${member.username}/vouches` },
    ],
    about: member.thread.summary,
    signature: "Clear terms, original work, and respectful collaboration.",
  };
}

export function findDemoCommunityMember(username: string) {
  return demoCommunityMembers.find(
    (member) => member.username.toLocaleLowerCase() === username.toLocaleLowerCase(),
  );
}

export function demoCommunityThreads(): ThreadListItem[] {
  return demoCommunityMembers.map((member, index) => ({
    id: 11000 + index,
    slug: member.thread.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    forumSlug: member.thread.forumSlug,
    title: member.thread.title,
    type: member.thread.type,
    creator: member.username,
    avatarSeed: member.username.slice(0, 2),
    avatarUrl: member.avatarUrl,
    replies: Math.max(3, Math.round(member.vouches / 4)),
    views: Math.max(120, member.sourcePostCount * 3),
    latestReplyAt: `${index + 2} minutes ago`,
    latestReplier: demoCommunityMembers[(index + 1) % demoCommunityMembers.length].username,
    isPinned: index < 2,
    badges: index === 0 ? ["Premium"] : index === 4 ? ["Mentor"] : undefined,
  }));
}
