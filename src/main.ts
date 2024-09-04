import * as engine from "./engine";
import { get as getPassage, init as initPassages } from "./passages";
import { evalJavaScript } from "./scripting";
import { getElementById } from "./util";

const { alert, document } = globalThis;

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

// The main Brick object that is viewable to authors
export const Brick = {
  vars: {} as Record<string, unknown>,
};

declare global {
  interface Window {
    Brick: typeof Brick;
  }
}
window.Brick = Brick;

const storyData = document.getElementsByTagName("tw-storydata")[0];
initPassages(storyData);
const styles = storyData.querySelectorAll('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript"]');

for (const stylesheet of styles) {
  const styleElt = document.createElement("style");
  styleElt.append(stylesheet.textContent || "");
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

document.getElementById("brick-history-backward")?.addEventListener("click", engine.backward);
document.getElementById("brick-history-forward")?.addEventListener("click", engine.forward);

document
  .getElementById("brick-saves")
  ?.addEventListener("click", () => alert("Sorry, saves aren't supported yet."));
document.getElementById("brick-restart")?.addEventListener("click", () => window.location.reload());
