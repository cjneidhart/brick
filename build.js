import fs from "node:fs";
import { env } from "node:process";
import esbuild from "esbuild";

function readTextFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

const debug = !!env.BRICK_DEBUG;
const version = env.npm_package_version;
if (!version) {
  throw new Error("This script must be run as `npm run build`");
}

fs.mkdirSync("storyformats/brick", { recursive: true });

const baseContext = {
  bundle: true,
  minify: !debug,
  sourcemap: debug ? "inline" : false,
  // These are the oldest versions which support Unicode character classes
  // (\p{...} or \P{...}) in regular expressions.
  target: ["firefox78", "chrome64", "safari12"],
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
    bundle: false, // So it doesn't get wrapped in an IIFE
    entryPoints: ["src/extend-twine.js"],
  }),
]);
const [brickJs, brickCss, editorExtensions] = buildContexts.map((ctx) => ctx.outputFiles[0].text);

const template = readTextFile("src/brick.html");
const reboot = readTextFile("node_modules/bootstrap/dist/css/bootstrap-reboot.min.css");

const storyFormat = template
  .replace("/*BOOTSTRAP_STYLE*/", reboot.replaceAll("$", "$$$$"))
  .replace(/#\s*sourceMappingURL=bootstrap.*map/gm, "")
  .replace("/*BRICK_SCRIPT*/", brickJs.replaceAll("$", "$$$$"))
  .replace("/*BRICK_STYLE*/", brickCss.replaceAll("$", "$$$$"));

const storyJson = {
  name: "Brick",
  version,
  author: "Chris Neidhart",
  image: "icon.svg",
  description:
    "A modern story format with a JavaScript-like syntax, " +
    "and a focus on performance and simplicity.<br><br>" +
    '<a href="https://github.com/cjneidhart/brick">Homepage</a>',
  source: storyFormat,
  hydrate: editorExtensions.replace("(void 0).editorExtensions", "this.editorExtensions"),
  url: "https://github.com/cjneidhart/brick",
  license: "GPL-3.0",
};

const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;
fs.writeFileSync("storyformats/brick/format.js", outString);
fs.copyFileSync("icon.svg", "storyformats/brick/icon.svg");
