import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";
import * as saves from "./saves";
import { clone, getElementById, makeElement } from "./util";

export interface Moment {
  passageName: string;
  vars: Record<string, unknown>;
}

let mainElt: Element;
let history: Moment[];
let index: number;
export let storyVariables: Record<string, unknown>;
export let tempVariables: Record<string, unknown>;

/** Initialize the engine */
export function init() {
  mainElt = getElementById("brick-main");
  history = [];
  index = -1;
  storyVariables = {};
  tempVariables = {};
}

/** Attempt to move backwards in history. Returns whether the navigation was successful. */
export function backward(): boolean {
  if (index === 0) {
    return false;
  } else {
    index--;
    saves.saveActive({ history, index });
    renderActive();
    return true;
  }
}

/** Attempt to move forward in history. Returns whether the navigation was successful. */
export function forward(): boolean {
  if (index === history.length - 1) {
    return false;
  } else {
    index++;
    saves.saveActive({ history, index });
    renderActive();
    return true;
  }
}

/** Navigate to the given passage, creating a new moment in the history. */
export function navigate(passage: string | Passage) {
  const passageName = typeof passage === "string" ? passage : passage.name;

  // clear moments past the current index
  history.length = index + 1;

  const newMoment = {
    passageName,
    vars: clone(storyVariables),
  };
  history.push(newMoment);
  index++;

  saves.saveActive({ history, index });
  renderActive();
}

/** Render the active moment. */
function renderActive() {
  const moment = history[index];
  if (!moment) {
    throw new Error(`No active moment at index ${index}`);
  }

  const psg = getPassage(moment.passageName);
  if (!psg) {
    throw new Error(`Couldn't find passage "${moment.passageName}"`);
  }

  storyVariables = clone(moment.vars);
  tempVariables = {};

  mainElt.innerHTML = "";
  const newDiv = makeElement("div", { class: "opacity-0 fade-in" });
  render(newDiv, psg.content);
  mainElt.append(newDiv);
  setTimeout(() => newDiv.classList.remove("opacity-0"), 40);
}

export function loadFromActive(): boolean {
  const state = saves.loadActive();
  if (state) {
    history = state.history;
    index = state.index;
    renderActive();
    return true;
  } else {
    return false;
  }
}

export function restart() {
  saves.clearActive();
  window.location.reload();
}
