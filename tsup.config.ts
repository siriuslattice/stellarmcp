import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  target: "node22",
  outDir: "dist",
  banner: { js: "#!/usr/bin/env node" },
  // @stellar/stellar-sdk is a dev/optional dep — only loaded by ReflectorOracle
  // when REFLECTOR_CONTRACT_ID is configured. Mark as external so it's not bundled.
  external: ["@stellar/stellar-sdk"],
});
