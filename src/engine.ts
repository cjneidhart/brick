import config from "./config";
import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";
import * as saves from "./saves";
import { clone, getElementById, makeElement } from "./util";

export interface Moment {
  passageName: string;
  vars: Record<string, unknown>;
}

let mainElement: HTMLElement;
let history: Moment[];
let index: number;
export let storyVariables: Record<string, unknown>;
export let tempVariables: Record<string, unknown>;

/** Initialize the engine */
export function init() {
  mainElement = getElementById("brick-main");
  mainElement.innerHTML = "";
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

  if (config.stream) {
    for (const elt of mainElement.querySelectorAll(":enabled")) {
      elt.setAttribute("disabled", "");
    }
    for (const elt of document.querySelectorAll(".brick-active-passage")) {
      elt.classList.remove("brick-active-passage");
    }
    // container.append(makeElement("hr"));
  } else {
    mainElement.innerHTML = "";
  }

  const article = makeElement("article", {
    class: "brick-passage brick-active-passage brick-transparent",
  });
  const header = getPassage("StoryHeader");
  const footer = getPassage("StoryFooter");
  if (header) render(article, header);
  render(article, psg);
  if (footer) render(article, footer);
  mainElement.append(article);
  article.scrollIntoView();
  setTimeout(() => article.classList.remove("brick-transparent"), 40);
}

export function loadFromActive(): boolean {
  const state = saves.loadActive();
  if (state) {
    loadState(state);
    return true;
  } else {
    return false;
  }
}

export function loadFromSlot(slot: number): boolean {
  const state = saves.loadFromSlot(slot);
  if (state) {
    loadState(state);
    return true;
  } else {
    return false;
  }
}

export function saveToSlot(slot: number) {
  saves.saveToSlot(slot, { history, index });
}

function loadState(state: saves.SaveState) {
  history = state.history;
  index = state.index;
  renderActive();
}

export function restart() {
  saves.clearActive();
  window.location.reload();
}
