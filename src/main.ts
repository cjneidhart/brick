import { PassageIndex } from "./passages";
import { render } from "./renderer";

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

const Brick = (<any>globalThis).Brick = {
  evalJavaScript(js: string): unknown {
    const fn = new Function(`'use strict';${js}`);
    return fn();
  },

  evalExpression(js: string): unknown {
    return Brick.evalJavaScript("return " + js);
  },


};
Object.freeze(Brick);

function getElementById(elementId: string): Element {
  const elt = document.getElementById(elementId);
  if (!elt) {
    throw new Error(`No element with id '${elementId} found`);
  }
  return elt;
}

const storyData = document.getElementsByTagName("tw-storydata")[0];
const passages = new PassageIndex(storyData);
const styles = storyData.querySelectorAll('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript]');

for (const stylesheet of styles) {
  const styleElt = document.createElement("style");
  styleElt.append(stylesheet.innerHTML);
  document.head.appendChild(styleElt);
}

for (const script of scripts) {
  Brick.evalJavaScript(script.innerHTML);
}

const passagesDiv = getElementById("passages");

const startPassage = passages.get("Start");
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
