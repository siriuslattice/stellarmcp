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
    const result = parseAsset("AQUARIUS:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result.code).toBe("AQUARIUS");
    expect(result.assetType).toBe("credit_alphanum12");
  });

  it("should throw on invalid format", () => {
    expect(() => parseAsset("INVALID")).toThrow("Invalid asset format");
  });

  it("should throw on too many colons", () => {
    expect(() => parseAsset("A:B:C")).toThrow("Invalid asset format");
  });

  it("should throw on asset code longer than 12 characters", () => {
    expect(() =>
      parseAsset("ABCDEFGHIJKLM:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toThrow("Invalid asset code");
  });

  it("should throw on asset code with special characters", () => {
    expect(() =>
      parseAsset("US$C:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toThrow("Invalid asset code");
  });

  it("should throw on empty asset code", () => {
    expect(() =>
      parseAsset(":GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toThrow("Invalid asset code");
  });

  it("should throw on issuer with wrong length", () => {
    expect(() => parseAsset("USDC:GABCD")).toThrow("Invalid issuer address");
  });

  it("should throw on issuer not starting with G", () => {
    expect(() =>
      parseAsset("USDC:SA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toThrow("Invalid issuer address");
  });

  it("should throw on issuer with invalid Base32 characters", () => {
    // '0', '1', '8', '9' and lowercase are not in the Base32 alphabet A-Z, 2-7
    expect(() =>
      parseAsset("USDC:G00ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    ).toThrow("Invalid issuer address");
  });

  it("should accept valid 12-char asset code (credit_alphanum12)", () => {
    const result = parseAsset("ABCDEFGHIJKL:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result.code).toBe("ABCDEFGHIJKL");
    expect(result.assetType).toBe("credit_alphanum12");
    expect(result.isNative).toBe(false);
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
