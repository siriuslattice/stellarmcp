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
  if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
    throw new Error(
      `Invalid asset code: "${code}". Must be 1-12 alphanumeric characters.`,
    );
  }
  if (!/^G[A-Z2-7]{55}$/.test(issuer)) {
    throw new Error(
      `Invalid issuer address: "${issuer}". Must be 56 characters starting with G (Base32 alphabet).`,
    );
  }
  const assetType = code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
  return { code, issuer, isNative: false, assetType };
}

export function formatStroops(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / 10_000_000n;
  const frac = (n % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}
