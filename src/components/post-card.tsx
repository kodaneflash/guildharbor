import { CalendarDays, Edit3, Flag, Link2, MessageSquareQuote, ShieldPlus } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/user-avatar";

export function PostCard({ index = 1 }: { index?: number }) {
  return (
    <article id={`post-${index}`} className="surface overflow-hidden">
      <div className="grid md:grid-cols-[238px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-panel-raised p-4 md:border-b-0 md:border-r md:p-6">
          <div className="flex items-center gap-3 md:block">
            <UserAvatar seed="AS" size="lg" className="md:mx-auto md:size-32 md:text-3xl" />
            <div className="min-w-0 md:mt-4 md:text-center">
              <Link href="/members/Aster" className="text-lg font-extrabold text-text hover:text-category">Aster</Link>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-cyan">Verified mentor</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
            <div className="bg-panel p-3 text-center"><strong className="block text-lg text-trust">3,495</strong><span className="text-[11px] text-text-muted">Reputation</span></div>
            <div className="bg-panel p-3 text-center"><strong className="block text-lg text-trust">1,058</strong><span className="text-[11px] text-text-muted">Vouches</span></div>
          </div>
          <dl className="mt-4 hidden space-y-2 text-xs md:block">
            <div className="flex justify-between rounded-md bg-panel px-3 py-2.5"><dt className="text-text-muted">Posts</dt><dd className="font-bold text-text-secondary">1,710</dd></div>
            <div className="flex justify-between rounded-md bg-panel px-3 py-2.5"><dt className="text-text-muted">Threads</dt><dd className="font-bold text-text-secondary">18</dd></div>
            <div className="flex justify-between rounded-md bg-panel px-3 py-2.5"><dt className="text-text-muted">Joined</dt><dd className="font-bold text-text-secondary">Nov 2020</dd></div>
          </dl>
        </aside>
        <div className="min-w-0 p-4 sm:p-6 md:p-7">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <CalendarDays className="size-4" />
              <time dateTime="2026-07-28T11:30:00-04:00">Today at 11:30 AM</time>
              {index > 1 && <><Edit3 className="ml-2 size-3.5" /><span>Edited</span></>}
            </div>
            <a href={`#post-${index}`} className="text-sm font-extrabold text-text-muted hover:text-text">#{index}</a>
          </header>
          <div className="prose-forum py-6">
            {index === 1 ? (
              <>
                <h2>Design system audit for growing product teams</h2>
                <p>I’m opening a small number of slots for a practical design-system and accessibility review. The engagement is aimed at teams with an existing React or Next.js product that needs a clearer component foundation.</p>
                <div className="my-5 rounded-md border-l-2 border-cyan bg-page p-4">
                  <strong className="text-cyan">What is included</strong>
                  <ul>
                    <li>Component inventory and consistency review</li>
                    <li>Keyboard, focus, and contrast audit</li>
                    <li>Prioritized remediation notes with implementation examples</li>
                    <li>A recorded walkthrough for your product and engineering team</li>
                  </ul>
                </div>
                <p>Pricing is scoped after a short written intake. All deliverables are original work, and client materials remain confidential. Message me with the product size and the outcome you want.</p>
              </>
            ) : (
              <>
                <p>I worked with Aster on a dashboard review last month. The recommendations were clear, prioritized, and easy for our team to apply without a rewrite.</p>
                <blockquote>Start with the interaction paths people use most, then strengthen the system around them.</blockquote>
              </>
            )}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-xs italic text-text-muted">Build for people first.</span>
            <div className="flex flex-wrap gap-1">
              <button className="button-secondary min-h-9 px-3" type="button"><MessageSquareQuote className="size-3.5" /> Quote</button>
              <button className="button-secondary min-h-9 px-3" type="button"><ShieldPlus className="size-3.5" /> Rep</button>
              <button className="button-secondary min-h-9 px-3" type="button"><Flag className="size-3.5" /> Report</button>
              <a className="button-secondary min-h-9 px-3" href={`#post-${index}`} aria-label={`Permalink to post ${index}`}><Link2 className="size-3.5" /></a>
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}
