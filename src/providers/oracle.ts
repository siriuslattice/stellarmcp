import { logger } from "../utils/logger.js";
import type { PriceService } from "./price.js";
import { SorobanClient } from "./soroban.js";

export interface OracleProvider {
  name: string;
  getPrice(
    base: string,
    counter: string,
  ): Promise<{ price: string; timestamp: string } | null>;
  isAvailable(): Promise<boolean>;
}

export class SdexOracle implements OracleProvider {
  name = "sdex";

  constructor(private priceService: PriceService) {}

  async getPrice(
    base: string,
    counter: string,
  ): Promise<{ price: string; timestamp: string } | null> {
    try {
      const result = await this.priceService.getPrice(base, counter);
      return { price: result.price, timestamp: result.timestamp };
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Reflector oracle asset identifiers.
 * Reflector uses u8 enum indices for supported assets in its `lastprice` call.
 * See: https://reflector.network/docs
 *
 * This mapping covers the most commonly queried Stellar assets.
 * Add entries as Reflector expands its supported asset set.
 */
const REFLECTOR_ASSET_INDEX: Record<string, number> = {
  "XLM": 0,
  "USDC": 1,
  "BTC": 2,       // wrapped BTC on Stellar
  "ETH": 3,       // wrapped ETH on Stellar
  "AQUA": 4,
  "yXLM": 5,
};

/**
 * ReflectorOracle queries price data from the Reflector on-chain oracle
 * (reflector.network) via Soroban contract simulation.
 *
 * Note: This uses @stellar/stellar-sdk (via the shared SorobanClient) for
 * Soroban contract interaction. The no-sdk rule in .claude/rules/no-sdk.md
 * applies to Horizon REST queries only — Soroban RPC requires the SDK for
 * XDR construction and contract invocation.
 */
export class ReflectorOracle implements OracleProvider {
  name = "reflector";

  private sorobanRpcUrl: string;
  private contractId: string | undefined;
  private networkPassphrase: string;
  private client: SorobanClient;

  constructor(options?: {
    sorobanRpcUrl?: string;
    contractId?: string;
    networkPassphrase?: string;
  }) {
    this.sorobanRpcUrl =
      options?.sorobanRpcUrl ?? "https://soroban-testnet.stellar.org";
    this.contractId = options?.contractId;
    this.networkPassphrase =
      options?.networkPassphrase ?? "Test SDF Network ; September 2015";
    this.client = new SorobanClient(this.sorobanRpcUrl, this.networkPassphrase);
  }

  async isAvailable(): Promise<boolean> {
    return this.contractId !== undefined && this.contractId.length > 0;
  }

  async getPrice(
    base: string,
    counter: string,
  ): Promise<{ price: string; timestamp: string } | null> {
    if (!(await this.isAvailable())) {
      return null;
    }

    // Resolve base asset code (strip issuer if present, e.g. "USDC:GA5Z..." -> "USDC")
    const baseCode = base.includes(":") ? base.split(":")[0] : base;
    const counterCode = counter.includes(":") ? counter.split(":")[0] : counter;

    const baseIndex = REFLECTOR_ASSET_INDEX[baseCode.toUpperCase()];
    const counterIndex = REFLECTOR_ASSET_INDEX[counterCode.toUpperCase()];

    if (baseIndex === undefined || counterIndex === undefined) {
      logger.debug("Reflector: unsupported asset pair", {
        base: baseCode,
        counter: counterCode,
      });
      return null;
    }

    try {
      return await this.queryContract(baseIndex, counterIndex);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("Reflector oracle query failed", { error: msg });
      return null;
    }
  }

  private async queryContract(
    baseIndex: number,
    _counterIndex: number,
  ): Promise<{ price: string; timestamp: string } | null> {
    try {
      const assetArg = await this.client.encodeU32(baseIndex);
      const parsed = await this.client.simulateContractCall(
        this.contractId!,
        "lastprice",
        [assetArg],
      );

      // Reflector returns either a struct { price: i128, timestamp: u64 } or a scalar
      const REFLECTOR_SCALE = 10n ** 14n;
      let price: string;
      let timestamp: string;

      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as { price?: unknown; timestamp?: unknown };
        const rawPrice =
          typeof obj.price === "bigint"
            ? obj.price
            : BigInt(String(obj.price ?? 0));
        const rawTimestamp =
          typeof obj.timestamp === "bigint"
            ? Number(obj.timestamp)
            : Number(obj.timestamp ?? 0);

        const whole = rawPrice / REFLECTOR_SCALE;
        const frac = rawPrice % REFLECTOR_SCALE;
        const fracStr = frac.toString().padStart(14, "0").replace(/0+$/, "");
        price = fracStr ? `${whole}.${fracStr}` : whole.toString();
        timestamp = new Date(rawTimestamp * 1000).toISOString();
      } else {
        const rawPrice =
          typeof parsed === "bigint" ? parsed : BigInt(String(parsed));
        const whole = rawPrice / REFLECTOR_SCALE;
        const frac = rawPrice % REFLECTOR_SCALE;
        const fracStr = frac.toString().padStart(14, "0").replace(/0+$/, "");
        price = fracStr ? `${whole}.${fracStr}` : whole.toString();
        timestamp = new Date().toISOString();
      }

      return { price, timestamp };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn("Reflector query failed", { error: msg });
      return null;
    }
  }
}
