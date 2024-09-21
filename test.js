// Call tweego on each test file

const fs = require("node:fs");
const { execSync } = require("node:child_process");

const RE = /^(.*)\.twee$/;

for (const dirent of fs.readdirSync("test", { withFileTypes: true })) {
  if (dirent.isDirectory()) {
    execSync(`tweego -o 'test/${dirent.name}.html' 'test/${dirent.name}'`);
  }
}
