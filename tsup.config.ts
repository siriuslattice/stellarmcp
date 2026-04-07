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
});
