import { requireMember } from "@/lib/session";
import { DealDraftForm } from "@/components/deal-forms";
export default async function NewDealPage() { await requireMember(); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Create optional escrow agreement</h1><DealDraftForm /></div>; }
