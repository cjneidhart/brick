import * as dialog from "./dialog";
import * as engine from "./engine";
import * as macros from "./macros";
import * as modules from "./modules";
import * as passages from "./passages";
import { renderPassage } from "./renderer";
import * as saves from "./saves";
import * as scripting from "./scripting";
import { getElementById, makeElement, slugify, stringify } from "./util";

declare global {
  interface Window {
    Brick: typeof scripting.BrickPublic;

    brickInit: typeof init;
    brickFinish: typeof finish;
  }

  // textContent is only `null` for `document`, for all Elements it is always a string.
  interface Element {
    textContent: string;
  }
}

async function init() {
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

  dialog.init(slugify(storyTitle));
  await saves.init(storyTitle, ifid);
  await engine.init();
  scripting.init();
  macros.installBuiltins(engine.constants);

  // "macro"-tagged passages
  for (const psg of passages.withTag("macro")) {
    if (!/\p{ID_Start}\p{ID_Continue}*/u.test(psg.name)) {
      throw new Error(
        `The passage "${psg.name}" cannot be made into a macro. ` +
          'Either change its name to a valid identifier, or remove the "macro" tag.',
      );
    }
    const macro: macros.Macro = (context, ...args) => {
      if (context.content) {
        throw new Error('This macro was created with the "macro" tag and cannot take children');
      }
      if (args.length !== 0) {
        throw new Error(
          'This macro was created with the "macro" tag and does not accept arguments',
        );
      }
      const div = makeElement("div");
      renderPassage(div, engine.tempVariables, psg);
      return div;
    };
    macro[macros.BRICK_MACRO_SYMBOL] = true;
    engine.constants[psg.name] = macro;
  }

  await modules.init(storyData);
  for (const script of scripts) {
    const url = URL.createObjectURL(new Blob([script.textContent], { type: "text/javascript" }));
    await import(url);
    URL.revokeObjectURL(url);
  }

  const storyInit = passages.get("StoryInit");
  if (storyInit) {
    const div = makeElement("div");
    renderPassage(div, engine.tempVariables, storyInit);
    div.normalize();
    const trimmed = div.textContent.trim();
    if (trimmed) {
      console.warn(
        "StoryInit, when rendered, contained non-whitespace characters. " +
          "This is likely an error. Its contents:\n" +
          trimmed,
      );
    }
  }

  await engine.resumeOrStart();
}

function finish() {
  saves.finish();
}

window.brickInit = init;
window.brickFinish = finish;

if (!document.documentElement.dataset.brickTest) {
  // only install the top-level error handlers when not testing
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

  init();
}
