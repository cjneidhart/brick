import * as dialog from "./dialog";
import * as engine from "./engine";
import * as macros from "./macros";
import * as passages from "./passages";
import { init as initSaves } from "./saves";
import * as scripting from "./scripting";
import { getElementById, makeElement, slugify, stringify } from "./util";

declare global {
  interface Window {
    Brick: typeof scripting.BrickPublic;
  }

  // textContent is only `null` for `document`, for all Elements it is always a string.
  interface Element {
    textContent: string;
  }
}

window.addEventListener("error", (event) => {
  const { error } = event;
  let msg = "";
  if (error instanceof Error) {
    msg += "Fatal Error!\n";
    msg += error.toString();
    if (error.stack) {
      msg += "\n" + error.stack;
    }
  } else if (error instanceof macros.BreakSignal) {
    msg += `@${error.type} was called outside a loop, at "${error.context.passageName}" line ${error.context.lineNumber}`;
  } else {
    msg += "Non-error object was thrown and not caught:\n";
    msg += stringify(event);
  }
  alert(msg);
});

window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  alert(`Fatal Error!\n${reason}`);
});

const storyData = document.getElementsByTagName("tw-storydata")[0];
passages.init(storyData);
const styles = storyData.querySelectorAll('style[type="text/twine-css"]');
const scripts = storyData.querySelectorAll('script[type="text/twine-javascript"]');

const storyInterface = passages.get("StoryInterface");
if (storyInterface) {
  getElementById("brick-viewport").outerHTML = storyInterface.content;
}

const storyTitle =
  storyData.getAttribute("name") ||
  (() => {
    throw new Error("Story has no title");
  })();
const ifid = storyData.getAttribute("ifid") || "00000000-0000-4000-A000-000000000000";

for (const stylesheet of styles) {
  const styleElt = makeElement("style", { class: "brick-author-style" }, stylesheet.textContent);
  document.head.appendChild(styleElt);
}

function addClicker(id: string, handler: (this: HTMLElement, event: MouseEvent) => unknown) {
  document.getElementById(id)?.addEventListener("click", handler);
}

addClicker("brick-history-backward", engine.backward);
addClicker("brick-history-forward", engine.forward);
addClicker("brick-saves", dialog.showSavesMenu);
addClicker("brick-restart", dialog.showRestartPrompt);

async function init() {
  dialog.init(slugify(storyTitle));
  await initSaves(storyTitle, ifid);
  await engine.init();
  scripting.init();
  macros.installBuiltins(engine.constants);

  for (const script of scripts) {
    scripting.evalJavaScript(script.textContent);
  }

  await engine.resumeOrStart();
}

init();
