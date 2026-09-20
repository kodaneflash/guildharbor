"use client";
import { useActionState } from "react";
import { createCaseAction, updateCaseAction } from "@/app/(account-help)/support/actions";
export function SupportForm({ dealId, conversationId }: { dealId?: string; conversationId?: string }) {
  const [state, action, pending] = useActionState(createCaseAction, { message: "" });
  return <form action={action} className="surface space-y-4 p-6">{dealId && <input type="hidden" name="dealId" value={dealId} />}{conversationId && <input type="hidden" name="conversationId" value={conversationId} />}<label className="block">Subject<input className="field mt-2" name="subject" minLength={5} maxLength={160} required /></label><label className="block">Describe the issue<textarea className="field mt-2 min-h-40" name="body" minLength={20} maxLength={10000} required /></label>{(dealId || conversationId) && <p className="text-body-sm">Submitting grants assigned support staff audited access to the linked conversation as evidence.</p>}<button className="button-primary" disabled={pending}>Create support case</button><p role="status">{state.message}</p></form>;
}
export function SupportReply({ id, staff, deal }: { id: string; staff: boolean; deal: boolean }) {
  const [state, action, pending] = useActionState(updateCaseAction, { message: "" });
  return <form action={action} className="surface space-y-4 p-6"><input type="hidden" name="id" value={id} /><label className="block">Reply or decision reason<textarea className="field mt-2 min-h-32" name="body" minLength={5} maxLength={10000} required /></label><label className="block">Action<select className="field mt-2" name="action"><option value="reply">Reply</option><option value="close">Close case</option><option value="reopen">Reopen case</option>{staff && <option value="resolve">Resolve case</option>}{staff && deal && <option value="cancel_deal">Cancel linked unfunded agreement for policy/abuse</option>}</select></label><button className="button-primary" disabled={pending}>Save case update</button><p role="status">{state.message}</p></form>;
}
