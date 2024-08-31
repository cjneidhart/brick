import { backward, forward, navigate } from "./engine";
import { get as getPassage, init as initPassages } from "./passages";
import { evalJavaScript } from "./scripting";

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

function getElementById(elementId: string): Element {
  const elt = document.getElementById(elementId);
  if (!elt) {
    throw new Error(`No element with id '${elementId} found`);
  }
  return elt;
}

const storyData = document.getElementsByTagName("tw-storydata")[0];
initPassages(storyData);
const styles = storyData.querySelectorAll('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript"]');

for (const stylesheet of styles) {
  const styleElt = document.createElement("style");
  styleElt.append(stylesheet.textContent || "");
  document.head.appendChild(styleElt);
}

for (const script of scripts) {
  evalJavaScript(script.textContent || "");
}

const startPassage = getPassage("Start");
if (!startPassage) {
  throw new Error("No starting passage found");
}

navigate(startPassage);

const storyTitle = storyData.getAttribute("name");
if (!storyTitle) {
  throw new Error("Story has no title");
}

const titleElt = getElementById("story-title");
titleElt.textContent = storyTitle;

document.getElementById("brick-history-backward")?.addEventListener("click", (_event) => {
  backward();
});
document.getElementById("brick-history-forward")?.addEventListener("click", (_event) => {
  forward();
})
