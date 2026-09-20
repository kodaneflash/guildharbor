"use client";
import { useActionState } from "react";
import { resolveReport } from "@/app/(product)/moderation/reports/actions";
export function ReportDecision({ reportId }: { reportId: number }) {
  const [state, action, pending] = useActionState(resolveReport, { message: "" });
  return <form action={action} className="space-y-3"><input type="hidden" name="reportId" value={reportId} /><label className="block">Decision<select className="field mt-2" name="status"><option value="triaged">In review</option><option value="actioned">Action completed</option><option value="dismissed">Dismiss</option></select></label><label className="block">Decision reason<textarea className="field mt-2" name="reason" minLength={5} maxLength={2000} required /></label><button className="button-primary" disabled={pending}>Record decision</button><p role="status">{state.message}</p></form>;
}
