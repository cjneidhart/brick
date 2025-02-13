/**
 * @module modules
 *
 * This module manages all "module"-tagged passages.
 */

import { makeElement } from "./util";

let moduleUrls: Record<string, string>;

export async function init(storyData: Element) {
  const elements = storyData.querySelectorAll(`tw-passagedata[tags~="module"]`);
  // Create URLs for all modules
  moduleUrls = Object.create(null);
  for (const element of elements) {
    const { name, url } = initModulePassage(element);
    moduleUrls[name] = url;
  }

  // Create a URL that exports all of Brick's properties
  const brickModuleTexts = [];
  for (const name in Brick) {
    brickModuleTexts.push(`export const ${name} = Brick.${name};\n`);
  }
  brickModuleTexts.push(`export default {\n`);
  for (const name in Brick) {
    brickModuleTexts.push(`${name},\n`);
  }
  brickModuleTexts.push(`};\n`);
  const blob = new Blob(brickModuleTexts, { type: "text/javascript" });
  const brickUrl = URL.createObjectURL(blob);
  moduleUrls.brick = brickUrl;

  // Create the importmap
  const importMap = makeElement(
    "script",
    { type: "importmap" },
    JSON.stringify({ imports: moduleUrls }),
  );
  document.head.append(importMap);

  // Issue warning for web twine
  if (elements.length > 0 && location.hostname === "twinery.org") {
    console.warn(
      "When using modules with web Twine, `import` statements might not work. " +
        "Use `await importPassage(PASSAGE_NAME)` instead if you have any issues.",
    );
  }

  // Import "brick" now, to ensure it runs before any other modules
  await import(brickUrl);
}

export function importPassage(moduleName: string): Promise<Record<string, unknown>> {
  const url = moduleUrls[moduleName];
  if (!url) {
    throw new Error(`No module passage named "${moduleName}" found.`);
  }
  return import(url);
}

function initModulePassage(element: Element): { name: string; url: string } {
  const name = element.getAttribute("name");
  if (!name) {
    throw new Error("No passage name");
  }
  let text = element.textContent;
  text = /^\s*@\(([^]*)\)\s*$/.exec(text)?.[1] ?? text;
  const blob = new Blob([text], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  return { name, url };
}
