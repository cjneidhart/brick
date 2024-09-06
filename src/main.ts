import * as engine from "./engine";
import { get as getPassage, init as initPassages } from "./passages";
import { BrickPublic, evalJavaScript } from "./scripting";
import { getElementById, makeElement } from "./util";

window.addEventListener("error", (event) => {
  const { error } = event;
  let msg = "";
  if (error instanceof Error) {
    msg += "Fatal Error!\n";
    msg += error.toString();
    if (error.stack) {
      msg += "\n" + error.stack;
    }
  } else {
    msg += "Non-error object was thrown and not caught:\n";
    msg += String(event);
  }
  alert(msg);
});

window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  alert(`Fatal Error!\n${reason}`);
});

declare global {
  interface Window {
    Brick: typeof BrickPublic;
  }
}
window.Brick = BrickPublic;

const storyData = document.getElementsByTagName("tw-storydata")[0];
initPassages(storyData);
const styles = storyData.querySelectorAll('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript"]');

for (const stylesheet of styles) {
  const styleElt = makeElement("style", {}, stylesheet.textContent || "");
  document.head.appendChild(styleElt);
}

engine.init();

for (const script of scripts) {
  evalJavaScript(script.textContent || "");
}

const startPassage = getPassage("Start");
if (!startPassage) {
  throw new Error("No starting passage found");
}

engine.navigate(startPassage);

const storyTitle = storyData.getAttribute("name");
if (!storyTitle) {
  throw new Error("Story has no title");
}

const titleElt = getElementById("story-title");
titleElt.textContent = storyTitle;

function addClicker(id: string, handler: (this: HTMLElement, event: MouseEvent) => unknown) {
  document.getElementById(id)?.addEventListener("click", handler);
}

addClicker("brick-history-backward", engine.backward);
addClicker("brick-history-forward", engine.forward);
addClicker("brick-saves", () => alert("Sorry, saves aren't supported yet."));
addClicker("brick-restart", () => window.location.reload());
