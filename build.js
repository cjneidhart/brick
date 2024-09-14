#!/usr/bin/env node

const fs = require("node:fs");
const process = require("node:process");
const path = require("node:path");
const webpack = require("webpack");

function readTextFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

const debug = process.env.BRICK_DEBUG;

/** @type {webpack.Configuration} */
const runtimeConfig = {
  entry: "./src/main.ts",
  mode: debug ? "development" : "production",
  devtool: debug ? "eval-source-map" : false,
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    clean: true,
    filename: "brick.js",
    path: path.resolve(__dirname, "dist"),
  },
};

function checkWebpackErrors(err, stats) {
  if (err) {
    console.error(err.stack || err);
    if (err.details) {
      console.error(err.details);
    }
    return false;
  }

  const info = stats.toJson();

  if (stats.hasErrors()) {
    for (const error of info.errors) {
      console.error(error.message);
      console.error(error.stack);
    }
  }

  if (stats.hasWarnings()) {
    for (const warning of info.warnings) {
      console.error(warning.message);
      console.error(warning.stack);
    }
  }

  return true;
}

function afterWebpack(err, stats) {
  if (!checkWebpackErrors(err, stats)) {
    return;
  }

  const templateText = readTextFile("template.html");
  const scriptText = readTextFile("dist/brick.js");
  const brickStyle = readTextFile("src/brick.css");
  const bsCss = readTextFile("node_modules/bootstrap/dist/css/bootstrap.min.css");
  // const bsJs = readTextFile("node_modules/bootstrap/dist/js/bootstrap.bundle.min.js");
  const editorExtensionsJs = readTextFile("twine-editor.js");

  const storyFormat = templateText
    .replace("{{BOOTSTRAP_CSS}}", bsCss.replaceAll("$", "$$$$"))
    // .replace("{{BOOTSTRAP_SCRIPT}}", bsJs.replaceAll("$", "$$$$"))
    .replaceAll(/#\s*sourceMappingURL=bootstrap.*map/gm, "")
    .replace("{{BRICK_SCRIPT}}", scriptText.replaceAll("$", "$$$$"))
    .replace("{{BRICK_STYLE}}", brickStyle.replaceAll("$", "$$$$"));
  const storyJson = {
    name: "Brick",
    version: "0.1",
    author: "OrangeChris",
    image: "icon.svg",
    description:
      "A fully featured, highly customizable story format with numerous programming features and a rich passage editor." +
      " No Harlowe experience required." +
      ' <a href="https://github.com/cjneidhart/brick">Homepage</a>',
    source: storyFormat,
    hydrate: editorExtensionsJs,
    // url: null,
    // license: null,
  };
  const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;

  fs.writeFileSync("storyformats/brick/format.js", outString);
  fs.copyFileSync("icon.svg", "storyformats/brick/icon.svg");
}

fs.mkdirSync("dist", { recursive: true });
fs.mkdirSync("storyformats/brick", { recursive: true });

webpack(runtimeConfig, afterWebpack);
