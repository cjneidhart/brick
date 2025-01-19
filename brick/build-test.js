import fs from "node:fs";
import { env } from "node:process";
import esbuild from "esbuild";
import { parse as semverParse } from "semver";

/* global URL */

const versionString = env.npm_package_version;
if (!versionString) {
  throw new Error("This script must be run as `pnpm test`");
}
let version = semverParse(versionString);
if (!version) {
  throw new Error(`Could not parse version "${versionString}"`);
}
version = {
  major: version.major,
  minor: version.minor,
  patch: version.patch,
  version: version.version,
  time: Date.now(),
};

const testSuiteContext = await esbuild.build({
  bundle: true,
  entryPoints: ["test/test-suite.ts"],
  write: false,
});
const testSuiteText = testSuiteContext.outputFiles[0].text;

const brickBuildContext = await esbuild.build({
  bundle: true,
  define: { BRICK_VERSION: JSON.stringify(version) },
  entryPoints: ["src/main.ts"],
  sourcemap: "inline",
  // These are the oldest versions which support Unicode character classes
  // (\p{...} or \P{...}) in regular expressions.
  target: ["firefox78", "chrome64", "safari12"],
  write: false,
});
const brickMinified = brickBuildContext.outputFiles[0].text;

const mochaJsUrl = import.meta.resolve("mocha/mocha.js");
const mochaJsText = fs.readFileSync(new URL(mochaJsUrl), { encoding: "utf-8" });
const mochaCssUrl = import.meta.resolve("mocha/mocha.css");
const mochaCssText = fs.readFileSync(new URL(mochaCssUrl), { encoding: "utf-8" });

const html = `
<!DOCTYPE html>
<html data-bs-theme="dark" data-brick-test="true">

<head>
  <title>Brick Test Suite</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style id="mocha-style">${mochaCssText}</style>
</head>

<body>
  <div id="mocha"></div>

  <script>${brickMinified}</script>

  <script>${mochaJsText}</script>

  <script>${testSuiteText}</script>
</body>

</html>
`;

fs.writeFileSync("test/brick-test.html", html, { encoding: "utf-8" });
