import { logger } from "../utils/logger.js";

/**
 * SorobanClient provides read-only contract simulation via Soroban RPC.
 *
 * Uses @stellar/stellar-sdk via dynamic import so the SDK stays an optional
 * peerDependency (not bundled in production). Requires @stellar/stellar-sdk
 * to be installed at runtime — either by the user or as a dev dep.
 *
 * All operations are read-only (simulation), no signing, no fees.
 */
export class SorobanClient {
  constructor(
    private rpcUrl: string,
    private networkPassphrase: string,
  ) {}

  /**
   * Encode a Stellar address (G... or C...) as a Soroban ScVal.
   */
  async encodeAddress(address: string): Promise<unknown> {
    const sdk = await import("@stellar/stellar-sdk");
    return sdk.nativeToScVal(address, { type: "address" });
  }

  /**
   * Encode a u32 integer as a Soroban ScVal.
   */
  async encodeU32(value: number): Promise<unknown> {
    const sdk = await import("@stellar/stellar-sdk");
    return sdk.nativeToScVal(value, { type: "u32" });
  }

  /**
   * Simulate a read-only contract method call.
   *
   * @param contractId - C... contract address
   * @param method - method name (e.g. "symbol", "balance")
   * @param args - pre-built ScVal arguments (use encodeAddress/encodeU32)
   * @returns parsed native JS value from scValToNative
   * @throws Error on simulation failure or RPC error
   */
  async simulateContractCall(
    contractId: string,
    method: string,
    args: unknown[] = [],
  ): Promise<unknown> {
    const sdk = await import("@stellar/stellar-sdk");
    const {
      Account,
      Contract,
      Networks,
      TransactionBuilder,
      Keypair,
      scValToNative,
      rpc,
    } = sdk;

    const server = new rpc.Server(this.rpcUrl);

    // Throwaway account for simulation (no signing, no balance check)
    const sourceKeypair = Keypair.random();
    const simulatedAccount = new Account(sourceKeypair.publicKey(), "0");

    const contract = new Contract(contractId);

    // Pick the network passphrase constant — fall back to whatever was provided
    const networkPassphrase =
      this.networkPassphrase === "Test SDF Network ; September 2015"
        ? Networks.TESTNET
        : this.networkPassphrase === "Public Global Stellar Network ; September 2015"
          ? Networks.PUBLIC
          : this.networkPassphrase;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = (contract.call as any)(method, ...args);

    const tx = new TransactionBuilder(simulatedAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      const errMsg = (simResult as { error?: string }).error ?? "unknown error";
      logger.warn("Soroban simulation error", { contractId, method, error: errMsg });
      throw new Error(`Soroban simulation failed: ${errMsg}`);
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      logger.warn("Soroban simulation did not succeed", { contractId, method });
      throw new Error("Soroban simulation did not succeed");
    }

    const retval = simResult.result?.retval;
    if (!retval) {
      throw new Error(`Soroban simulation returned no value for ${method}`);
    }

    return scValToNative(retval);
  }
}
