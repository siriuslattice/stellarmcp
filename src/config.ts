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

export type Config = typeof config;
