#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const webpack = require("webpack");

function readTextFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

const webpackConfig = {
  entry: "./src/main.ts",
  mode: "production",
  devtool: false,
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

function afterWebpack(err, stats) {
  if (err) {
    console.error(err.stack || err);
    if (err.details) {
      console.error(err.details);
    }
    return;
  }

  const info = stats.toJson();

  if (stats.hasErrors()) {
    console.error(info.errors);
  }

  if (stats.hasWarnings()) {
    console.warn(info.warnings);
  }

  const templateText = readTextFile("template.html");
  const scriptText = readTextFile("dist/brick.js");
  const brickStyle = readTextFile("src/brick.css");
  const bsCss = readTextFile("node_modules/bootstrap/dist/css/bootstrap.min.css");
  const bsJs = readTextFile("node_modules/bootstrap/dist/js/bootstrap.bundle.min.js");

  const storyFormat = templateText
    .replace("{{BOOTSTRAP_CSS}}", bsCss.replaceAll("$", "$$$$"))
    .replace("{{BOOTSTRAP_SCRIPT}}", bsJs.replaceAll("$", "$$$$"))
    .replaceAll(/#\s*sourceMappingURL=bootstrap.*map/gm, "")
    .replace("{{BRICK_SCRIPT}}", scriptText.replaceAll("$", "$$$$"))
    .replace("{{BRICK_STYLE}}", brickStyle.replaceAll("$", "$$$$"));
  const storyJson = {
    name: "Brick",
    version: "0.1",
    author: "OrangeChris",
    source: storyFormat,
  };
  const outString = `window.storyFormat(${JSON.stringify(storyJson)});`;

  fs.writeFileSync("storyformats/brick/format.js", outString);
}

fs.mkdirSync("dist", { recursive: true });
fs.mkdirSync("storyformats/brick", { recursive: true });

webpack(webpackConfig, afterWebpack);
