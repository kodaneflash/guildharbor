import dynamic from "next/dynamic";

import { createThreadAction } from "@/app/threads/new/actions";
import { Breadcrumbs } from "@/components/breadcrumbs";

const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then((module) => module.RichTextEditor));

export default async function NewThreadPage({ searchParams }: { searchParams: Promise<{ forum?: string }> }) {
  const { forum = "general" } = await searchParams;
  return (
    <div className="site-container max-w-5xl space-y-6 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Forums", href: "/forums" }, { label: "New thread" }]} />
      <header><h1 className="text-2xl font-extrabold text-text">Create a thread</h1><p className="mt-2 text-sm text-text-muted">Post accurate information and choose the type that best describes your thread.</p></header>
      <form action={createThreadAction} className="surface space-y-5 p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="mb-2 block text-xs font-bold text-text-secondary">Forum</span><select name="forum" defaultValue={forum} className="field"><option value="general">General Discussion</option><option value="digital-goods">Original Digital Goods</option><option value="domains">Domains</option><option value="services">Professional Services</option></select></label>
          <label><span className="mb-2 block text-xs font-bold text-text-secondary">Thread type</span><select name="type" className="field"><option value="discussion">Discussion</option><option value="selling">Selling</option><option value="buying">Buying</option><option value="service">Service</option></select></label>
        </div>
        <label><span className="mb-2 block text-xs font-bold text-text-secondary">Title</span><input className="field" name="title" minLength={5} maxLength={160} placeholder="A clear, specific title" required /></label>
        <div><span className="mb-2 block text-xs font-bold text-text-secondary">Post</span><RichTextEditor /></div>
        <label className="flex items-start gap-3 rounded-md border border-border bg-page p-4 text-xs leading-5 text-text-muted"><input type="checkbox" name="lawfulAttestation" className="mt-1" /><span>I confirm this post complies with the marketplace rules and does not offer credentials, identity data, unauthorized access, evasion, malware, or manipulated engagement.</span></label>
        <div className="flex justify-end gap-2"><button type="button" className="button-secondary">Save draft</button><button type="submit" className="button-primary">Publish thread</button></div>
      </form>
    </div>
  );
}
