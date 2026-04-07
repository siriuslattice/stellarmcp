export function parseAsset(input: string): {
  code: string;
  issuer?: string;
  isNative: boolean;
  assetType: "native" | "credit_alphanum4" | "credit_alphanum12";
} {
  if (input.toUpperCase() === "XLM") {
    return { code: "XLM", isNative: true, assetType: "native" };
  }
  const parts = input.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid asset format: ${input}. Use CODE:ISSUER or XLM`);
  }
  const code = parts[0];
  const issuer = parts[1];
  const assetType = code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
  return { code, issuer, isNative: false, assetType };
}

export function formatStroops(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / 10_000_000n;
  const frac = (n % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}
