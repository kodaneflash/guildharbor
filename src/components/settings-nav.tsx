import { LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";

export function SettingsNav({ active }: { active: "profile" | "security" }) { return <nav aria-label="Settings" className="surface h-fit p-2"><Link href="/settings/profile" className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold ${active === "profile" ? "bg-panel-strong text-text" : "text-text-muted hover:text-text"}`}><UserRound className="size-4" /> Profile</Link><Link href="/settings/security" className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold ${active === "security" ? "bg-panel-strong text-text" : "text-text-muted hover:text-text"}`}><LockKeyhole className="size-4" /> Security</Link></nav>; }
