import { requireMember } from "@/lib/session";
import { notFound } from "next/navigation";
export default async function OrderPage() { await requireMember(); notFound(); }
