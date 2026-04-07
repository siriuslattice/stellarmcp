import { describe, it, expect } from "vitest";
import { parseAsset, formatStroops } from "../../src/utils/formatters.js";

describe("parseAsset", () => {
  it("should parse XLM as native", () => {
    const result = parseAsset("XLM");
    expect(result).toEqual({ code: "XLM", isNative: true, assetType: "native" });
  });

  it("should parse xlm case-insensitively", () => {
    const result = parseAsset("xlm");
    expect(result).toEqual({ code: "XLM", isNative: true, assetType: "native" });
  });

  it("should parse credit_alphanum4 asset", () => {
    const result = parseAsset("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result.code).toBe("USDC");
    expect(result.issuer).toBe("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result.isNative).toBe(false);
    expect(result.assetType).toBe("credit_alphanum4");
  });

  it("should parse credit_alphanum12 asset", () => {
    const result = parseAsset("AQUARIUS:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67TCS");
    expect(result.code).toBe("AQUARIUS");
    expect(result.assetType).toBe("credit_alphanum12");
  });

  it("should throw on invalid format", () => {
    expect(() => parseAsset("INVALID")).toThrow("Invalid asset format");
  });

  it("should throw on too many colons", () => {
    expect(() => parseAsset("A:B:C")).toThrow("Invalid asset format");
  });
});

describe("formatStroops", () => {
  it("should format zero", () => {
    expect(formatStroops("0")).toBe("0.0000000");
  });

  it("should format whole number", () => {
    expect(formatStroops("10000000")).toBe("1.0000000");
  });

  it("should format fractional amount", () => {
    expect(formatStroops("15000000")).toBe("1.5000000");
  });

  it("should format large amount", () => {
    expect(formatStroops("1000000000000")).toBe("100000.0000000");
  });
});
