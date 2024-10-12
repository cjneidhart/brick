// Call tweego on each test file

import fs from "node:fs";
import { execSync } from "node:child_process";

for (const dirent of fs.readdirSync("test", { withFileTypes: true })) {
  if (dirent.isDirectory()) {
    execSync(`tweego -o 'test/${dirent.name}.html' 'test/${dirent.name}'`);
  }
}
