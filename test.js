// Call tweego on each test file

const fs = require("node:fs");
const { execSync } = require("node:child_process");

for (const dirent of fs.readdirSync("test", { withFileTypes: true })) {
  if (dirent.isDirectory()) {
    execSync(`tweego -o 'test/${dirent.name}.html' 'test/${dirent.name}'`);
  }
}
