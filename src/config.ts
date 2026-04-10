import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  stellarNetwork: z.enum(["testnet", "pubnet"]).default("testnet"),
  horizonUrl: z.string().url().default("https://horizon-testnet.stellar.org"),
  transport: z.enum(["stdio", "http"]).default("stdio"),
  stellarPayeeAddress: z.string().optional(),
  ozFacilitatorUrl: z.string().url().optional(),
  ozApiKey: z.string().optional(),
  port: z.coerce.number().default(4021),
  host: z.string().default("0.0.0.0"), // Binds to all interfaces — use "localhost" for local-only access
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  sorobanRpcUrl: z.string().url().optional(),
  reflectorContractId: z.string().optional(),
});

export const config = schema.parse({
  stellarNetwork: process.env.STELLAR_NETWORK,
  horizonUrl: process.env.HORIZON_URL,
  transport: process.env.TRANSPORT,
  stellarPayeeAddress: process.env.STELLAR_PAYEE_ADDRESS,
  ozFacilitatorUrl: process.env.OZ_FACILITATOR_URL,
  ozApiKey: process.env.OZ_API_KEY,
  port: process.env.PORT,
  host: process.env.HOST,
  logLevel: process.env.LOG_LEVEL,
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL,
  reflectorContractId: process.env.REFLECTOR_CONTRACT_ID,
});

// Mainnet-aware defaults: if URLs not explicitly set in env, pick the canonical
// endpoint for the configured network. Prevents the footgun where pubnet
// silently queries testnet.
const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";
const HORIZON_PUBNET_URL = "https://horizon.stellar.org";
const SOROBAN_TESTNET_URL = "https://soroban-testnet.stellar.org";
const SOROBAN_PUBNET_URL = "https://soroban-rpc.stellar.org";

if (!process.env.HORIZON_URL) {
  config.horizonUrl =
    config.stellarNetwork === "pubnet" ? HORIZON_PUBNET_URL : HORIZON_TESTNET_URL;
}

if (!process.env.SOROBAN_RPC_URL && !config.sorobanRpcUrl) {
  config.sorobanRpcUrl =
    config.stellarNetwork === "pubnet" ? SOROBAN_PUBNET_URL : SOROBAN_TESTNET_URL;
}

export type Config = typeof config;
