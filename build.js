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

fs.mkdirSync("bundle", { recursive: true });
fs.mkdirSync("storyformats/brick", { recursive: true });

await Promise.all([
  esbuild.build({
    bundle: true,
    entryPoints: ["src/brick.css", "src/main.ts"],
    minify: !debug,
    outdir: "bundle",
    sourcemap: debug ? "inline" : false,
  }),
  esbuild.build({
    bundle: false, // So it doesn't get wrapped in an IIFE
    entryPoints: ["src/extend-twine.js"],
    minify: !debug,
    outdir: "bundle",
    sourcemap: debug ? "inline" : false,
  }),
]);

const templateText = readTextFile("src/brick.html");
const scriptText = readTextFile("bundle/main.js");
const brickStyle = readTextFile("bundle/brick.css");
const bsCss = readTextFile("node_modules/bootstrap/dist/css/bootstrap-reboot.min.css");
const editorExtensionsJs = readTextFile("bundle/extend-twine.js");

const storyFormat = templateText
  .replace("/*BOOTSTRAP_STYLE*/", bsCss.replaceAll("$", "$$$$"))
  .replaceAll(/#\s*sourceMappingURL=bootstrap.*map/gm, "")
  .replace("/*BRICK_SCRIPT*/", scriptText.replaceAll("$", "$$$$"))
  .replace("/*BRICK_STYLE*/", brickStyle.replaceAll("$", "$$$$"));
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
  hydrate: editorExtensionsJs.replace("(void 0).editorExtensions", "this.editorExtensions"),
  // url: null,
  // license: null,
};
const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;

fs.writeFileSync("storyformats/brick/format.js", outString);
fs.copyFileSync("icon.svg", "storyformats/brick/icon.svg");
