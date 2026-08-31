import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  external: ["@aws-sdk/*", "@smithy/*"],
});

execSync("zip -j dist/lambda.zip dist/index.mjs", { stdio: "inherit" });
console.log("built dist/index.mjs and dist/lambda.zip");
