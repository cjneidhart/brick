import { init as initPassages, get as getPassage } from "./passages";
import { render } from "./renderer";
import { evalJavaScript } from "./scripting";

const { alert, document } = globalThis;

window.addEventListener('error', (event) => {
  const { error } = event;
  if (error instanceof Error) {
    let msg = 'Fatal Error!\n';
    msg += error.toString();
    if (error.stack) {
      msg += error.stack;
    }
    alert(msg);
  }
});

window.addEventListener('unhandledrejection', (event) => {
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
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript]');

for (const stylesheet of styles) {
  const styleElt = document.createElement("style");
  styleElt.append(stylesheet.textContent || '');
  document.head.appendChild(styleElt);
}

for (const script of scripts) {
  evalJavaScript(script.textContent || '');
}

const passagesDiv = getElementById("passages");

const startPassage = getPassage("Start");
if (!startPassage) {
  throw new Error("No starting passage found");
}

render(passagesDiv, startPassage.content);

const storyTitle = storyData.getAttribute('name');
if (!storyTitle) {
  throw new Error('Story has no title');
}

const titleElt = getElementById('story-title');
titleElt.textContent = storyTitle;
