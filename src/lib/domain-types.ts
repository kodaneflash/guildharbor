export type ThreadType = "discussion" | "announcement";

export type ThreadBadge = "Trending" | "Premium" | "Mentor" | "Locked";

export type ThreadListItem = {
  id: number;
  slug: string;
  forumSlug: string;
  title: string;
  type: ThreadType;
  creator: string;
  creatorAccent?: string;
  avatarSeed: string;
  avatarUrl?: string;
  replies: number;
  views: number;
  latestReplyAt: string;
  latestReplier: string;
  isPinned?: boolean;
  isUnread?: boolean;
  isSubscribed?: boolean;
  badges?: ThreadBadge[];
};

export type ForumSummary = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  threadCount: number;
  postCount: number;
  subforums?: string[];
};

export type ForumCategory = {
  slug: string;
  name: string;
  description: string;
  forums: ForumSummary[];
};

export type ProfileSummary = {
  username: string;
  displayName: string;
  tagline: string;
  avatarSeed: string;
  avatarUrl?: string;
  initials: string;
  joined: string;
  lastSeen: string;
  uid: string;
  telegram?: string;
  discord?: string;
  reputation: number;
  vouches: { positive: number; neutral: number; negative: number };
  threads: number;
  posts: number;
  years: number;
  badges: Array<{ label: string; icon: string; tone: string }>;
  groups: Array<{ name: string; subtitle: string; tone: string }>;
  activity: Array<{ title: string; detail: string; href: string }>;
  about: string;
  signature: unknown;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ActionResult<T> =
  | { status: "success"; data: T }
  | { status: "field_error"; fieldErrors: Record<string, string[]> }
  | { status: "error"; message: string };
