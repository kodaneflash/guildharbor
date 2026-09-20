import { redirect } from "next/navigation";
import { currentSellerProfile } from "@/domains/commerce/commerce-service";
import { SellerForm } from "@/components/commerce-forms";
export default async function SellerOnboardingPage() { if (await currentSellerProfile()) redirect("/seller"); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Open your storefront</h1><SellerForm /></div>; }
