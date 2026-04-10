import { logger } from "../utils/logger.js";
import type { PriceService } from "./price.js";

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
 * Note: This uses @stellar/stellar-sdk via dynamic import for Soroban
 * contract interaction. The no-sdk rule in .claude/rules/no-sdk.md applies
 * to Horizon REST queries only — Soroban RPC requires the SDK for XDR
 * construction and contract invocation.
 */
export class ReflectorOracle implements OracleProvider {
  name = "reflector";

  private sorobanRpcUrl: string;
  private contractId: string | undefined;
  private networkPassphrase: string;

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
    // Dynamic import: @stellar/stellar-sdk is a dev dependency but available at runtime
    // for Soroban contract simulation (read-only, no signing required)
    const sdk = await import("@stellar/stellar-sdk");
    const {
      Account,
      Contract,
      Networks,
      TransactionBuilder,
      Keypair,
      nativeToScVal,
      scValToNative,
      rpc,
    } = sdk;

    const server = new rpc.Server(this.sorobanRpcUrl);

    // Use a throwaway source account for simulation (no signing needed)
    const sourceKeypair = Keypair.random();
    const sourcePublicKey = sourceKeypair.publicKey();

    // Build a simulated account (simulation doesn't check balances)
    const simulatedAccount = new Account(sourcePublicKey, "0");

    const contract = new Contract(this.contractId!);

    // Reflector's `lastprice` takes an asset enum (u32 index)
    const assetArg = nativeToScVal(baseIndex, { type: "u32" });

    const networkPassphrase =
      this.networkPassphrase === "Test SDF Network ; September 2015"
        ? Networks.TESTNET
        : Networks.PUBLIC;

    const tx = new TransactionBuilder(simulatedAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(contract.call("lastprice", assetArg))
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      logger.warn("Reflector simulation returned error", {
        error: (simResult as { error?: string }).error,
      });
      return null;
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      logger.warn("Reflector simulation did not succeed");
      return null;
    }

    // Parse the result: Reflector returns a struct { price: i128, timestamp: u64 }
    const resultVal = simResult.result?.retval;
    if (!resultVal) {
      return null;
    }

    const parsed = scValToNative(resultVal);

    // Reflector prices are typically scaled by 10^14
    const REFLECTOR_SCALE = 10n ** 14n;
    let price: string;
    let timestamp: string;

    if (typeof parsed === "object" && parsed !== null) {
      // Struct with price and timestamp fields
      const rawPrice =
        typeof parsed.price === "bigint"
          ? parsed.price
          : BigInt(String(parsed.price ?? 0));
      const rawTimestamp =
        typeof parsed.timestamp === "bigint"
          ? Number(parsed.timestamp)
          : Number(parsed.timestamp ?? 0);

      // Convert scaled integer to decimal string
      const whole = rawPrice / REFLECTOR_SCALE;
      const frac = rawPrice % REFLECTOR_SCALE;
      const fracStr = frac.toString().padStart(14, "0").replace(/0+$/, "");
      price = fracStr ? `${whole}.${fracStr}` : whole.toString();
      timestamp = new Date(rawTimestamp * 1000).toISOString();
    } else {
      // Fallback: scalar value (just the price)
      const rawPrice =
        typeof parsed === "bigint" ? parsed : BigInt(String(parsed));
      const whole = rawPrice / REFLECTOR_SCALE;
      const frac = rawPrice % REFLECTOR_SCALE;
      const fracStr = frac.toString().padStart(14, "0").replace(/0+$/, "");
      price = fracStr ? `${whole}.${fracStr}` : whole.toString();
      timestamp = new Date().toISOString();
    }

    return { price, timestamp };
  }
}
