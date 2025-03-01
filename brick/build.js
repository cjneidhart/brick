import fs from "node:fs";
import { env } from "node:process";
import esbuild from "esbuild";
import { parse as semverParse } from "semver";
/* global URL */

function readTextFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

const debug = !!env.BRICK_DEBUG;
const versionString = env.npm_package_version;
if (!versionString) {
  throw new Error("This script must be run as `npm run build`");
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

fs.mkdirSync("storyformats/brick", { recursive: true });

const TWINE_EXTENSIONS_EXPORTS_NAME = "exports";

const baseContext = {
  bundle: true,
  define: { BRICK_VERSION: JSON.stringify(version) },
  minify: !debug,
  sourcemap: debug ? "inline" : false,
  // These are the oldest versions which support import maps
  target: ["firefox108", "chrome89", "safari16.4"],
  write: false,
};
const buildContexts = await Promise.all([
  esbuild.build({
    ...baseContext,
    entryPoints: ["src/main.ts"],
  }),
  esbuild.build({
    ...baseContext,
    entryPoints: ["src/brick.css"],
  }),
  esbuild.build({
    ...baseContext,
    entryPoints: ["twine-extensions/index.js"],
    format: "iife",
    globalName: TWINE_EXTENSIONS_EXPORTS_NAME,
  }),
]);
const [brickJs, brickCss, editorExtensions] = buildContexts.map((context) => {
  return context.outputFiles[0].text;
});

const template = readTextFile("src/brick.html");
const reboot = readTextFile(
  new URL(import.meta.resolve("bootstrap/dist/css/bootstrap-reboot.min.css")),
);

const storyFormat = template
  .replace("/*BOOTSTRAP_STYLE*/", reboot.replaceAll("$", "$$$$"))
  .replace(/#\s*sourceMappingURL=bootstrap.*map/gm, "")
  .replace("/*BRICK_SCRIPT*/", brickJs.replaceAll("$", "$$$$"))
  .replace("/*BRICK_STYLE*/", brickCss.replaceAll("$", "$$$$"));

const storyJson = {
  name: "Brick",
  version: versionString,
  author: "Chris Neidhart",
  image: "icon.svg",
  description:
    "A modern story format with a JavaScript-like syntax, " +
    "and a focus on performance and simplicity.<br><br>" +
    '<a href="https://github.com/cjneidhart/brick">Homepage</a>',
  source: storyFormat,
  hydrate:
    editorExtensions + `this.editorExtensions = ${TWINE_EXTENSIONS_EXPORTS_NAME}.editorExtensions`,
  url: "https://github.com/cjneidhart/brick",
  license: "GPL-3.0",
};

const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;
fs.writeFileSync("storyformats/brick/format.js", outString);
fs.copyFileSync("../icon.svg", "storyformats/brick/icon.svg");
