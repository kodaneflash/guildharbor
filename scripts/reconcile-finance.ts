import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const { reconcileLedger, reconcileCustody } = await import("../src/domains/finance/reconciliation");
const provider = process.argv.slice(2).includes("--provider");
const result = provider ? await reconcileCustody() : await reconcileLedger();
console.log(JSON.stringify(result, null, 2));
if (!result.balanced || result.issues.length || provider && !result.providerBackingVerified) process.exitCode = 1;
