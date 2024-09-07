// Call tweego on each test file

const fs = require("node:fs");
const { execSync } = require("node:child_process");

const RE = /\.twee$/;

for (const dirent of fs.readdirSync("test/stories")) {
  const m = RE.exec(dirent);
  if (m) {
    const n = m[1];
    execSync(`tweego -o 'test/${n}.html' 'test/stories/${dirent}'`);
  }
}
