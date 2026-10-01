/** Ethereum ERC-20 USDT uses six decimal places. Never convert these values to Number. */
export const USDT_SCALE = 1_000_000n;
export const MAX_ATOMS = 9_223_372_036_854_775_807n;

export function parseUsdt(value: string): bigint {
  if (!/^(0|[1-9]\d{0,12})(?:\.\d{1,6})?$/.test(value)) {
    throw new Error("Enter USDT with at most six decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const atoms = BigInt(whole) * USDT_SCALE + BigInt(fraction.padEnd(6, "0"));
  if (atoms > MAX_ATOMS) throw new Error("USDT amount exceeds storage capacity.");
  return atoms;
}

export function formatUsdt(atoms: bigint): string {
  const absolute = atoms < 0n ? -atoms : atoms;
  const fraction = (absolute % USDT_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${atoms < 0n ? "-" : ""}${absolute / USDT_SCALE}${fraction ? `.${fraction}` : ""}`;
}

export function positiveUsdt(value: string): bigint {
  const atoms = parseUsdt(value);
  if (atoms === 0n) throw new Error("USDT amount must be positive.");
  return atoms;
}

/** Pay-in quantities have their own network precision; they are never USDT
 * ledger amounts. Keep the existing bigint storage bound for exact persistence. */
export function parseAssetAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value) || value.length > 100) {
    throw new Error("Invalid asset amount.");
  }
  const [whole, fraction = ""] = value.split(".");
  if (/[1-9]/.test(fraction.slice(decimals))) throw new Error("Unsupported asset precision.");
  const atoms = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.slice(0, decimals).padEnd(decimals, "0") || "0");
  if (atoms > MAX_ATOMS) throw new Error("Asset amount exceeds storage range.");
  return atoms;
}

export function formatAssetAmount(atoms: bigint, decimals: number): string {
  if (atoms < 0n || atoms > MAX_ATOMS || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("Invalid asset amount.");
  const scale = 10n ** BigInt(decimals);
  const fraction = (atoms % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${atoms / scale}${decimals && fraction ? `.${fraction}` : ""}`;
}
