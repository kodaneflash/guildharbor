"use server";
import { revealSellerDeliverable } from "@/domains/commerce/protected-text";
export async function sellerPayloadAction(id: string) { return revealSellerDeliverable(id); }
