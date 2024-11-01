import fs from "node:fs";
import { env } from "node:process";
import esbuild from "esbuild";

function readTextFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

const debug = !!env.BRICK_DEBUG;
const { npm_package_version } = env;
if (!npm_package_version) {
  throw new Error("This script must be run as `npm run build`");
}

fs.mkdirSync("storyformats/brick", { recursive: true });

const buildContexts = await Promise.all([
  esbuild.build({
    bundle: true,
    entryPoints: ["src/main.ts"],
    minify: !debug,
    sourcemap: debug ? "inline" : false,
    write: false,
  }),
  esbuild.build({
    bundle: true,
    entryPoints: ["src/brick.css"],
    minify: !debug,
    sourcemap: debug ? "inline" : false,
    // The exact versions here do not matter,
    // we just need something old enough so esbuild removes CSS nesting.
    target: ["firefox54", "chrome51", "safari10"],
    write: false,
  }),
  esbuild.build({
    bundle: false, // So it doesn't get wrapped in an IIFE
    entryPoints: ["src/extend-twine.js"],
    minify: !debug,
    sourcemap: debug ? "inline" : false,
    write: false,
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
  version: npm_package_version,
  author: "OrangeChris",
  image: "icon.svg",
  description:
    "A fully featured, highly customizable story format with numerous programming features and a rich passage editor." +
    " No Harlowe experience required." +
    ' <a href="https://github.com/cjneidhart/brick">Homepage</a>',
  source: storyFormat,
  hydrate: editorExtensions.replace("(void 0).editorExtensions", "this.editorExtensions"),
  // url: null,
  // license: null,
};
const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;

fs.writeFileSync("storyformats/brick/format.js", outString);
fs.copyFileSync("icon.svg", "storyformats/brick/icon.svg");
