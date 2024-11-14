import * as dialog from "./dialog";
import * as engine from "./engine";
import * as passages from "./passages";
import { init as initSaves } from "./saves";
import { BrickPublic, evalJavaScript } from "./scripting";
import { makeElement } from "./util";

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
passages.init(storyData);
const styles = storyData.querySelectorAll<HTMLStyleElement>('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll<HTMLElement>('script[type="text/twine-javascript"]');

const storyTitle =
  storyData.getAttribute("name") ||
  (() => {
    throw new Error("Story has no title");
  })();
const ifid = storyData.getAttribute("ifid") || "00000000-0000-4000-A000-000000000000";

for (const stylesheet of styles) {
  const styleElt = makeElement("style", { class: "brick-author-style" }, stylesheet.innerText);
  document.head.appendChild(styleElt);
}

function addClicker(id: string, handler: (this: HTMLElement, event: MouseEvent) => unknown) {
  document.getElementById(id)?.addEventListener("click", handler);
}

addClicker("brick-history-backward", engine.backward);
addClicker("brick-history-forward", engine.forward);
addClicker("brick-saves", dialog.showSavesMenu);
addClicker("brick-restart", engine.restart);

async function init() {
  dialog.init();
  await initSaves(storyTitle, ifid);
  await engine.init();

  for (const script of scripts) {
    evalJavaScript(script.innerText);
  }

  await engine.resumeOrStart();
}

init();
