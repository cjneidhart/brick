import config from "./config";
import type { Passage } from "./passages";
import * as passages from "./passages";
import { render } from "./renderer";
import type { Moment } from "./saves";
import * as saves from "./saves";
import { clone, getElementById, makeElement } from "./util";

let mainElement: HTMLElement;
let historyIds: number[];
let historyMoments: (Moment | undefined)[];
let index: number;
let turnCount: number;
let passageName: string;
export let storyVariables: Record<string, unknown>;
export let tempVariables: Record<string, unknown>;

/** Initialize the engine */
export async function init() {
  mainElement = getElementById("brick-main");
  mainElement.innerHTML = "";
  const activeHistory = await saves.getHistory("active");
  if (activeHistory) {
    historyIds = activeHistory.momentIds;
    historyMoments = Array(historyIds.length);
    historyMoments.fill(undefined);
    index = activeHistory.index;
  } else {
    const moment: Moment = {
      passageName: passages.start().name,
      timestamp: Date.now(),
      turnCount: 1,
      vars: {},
    };
    historyMoments = [moment];
    historyIds = [await saves.putMoment(moment)];
    index = 0;
    saves.putHistory(historyIds, index, "active"); // Intentionally not awaited
  }
  await loadCurrentMoment();
  renderActive();
}

/** Fetch the current moment from IDB if necessary, then load its variables */
export async function loadCurrentMoment() {
  let moment = historyMoments[index];
  if (!moment) {
    moment = await saves.getMoment(historyIds[index]);
    historyMoments[index] = moment;
  }
  storyVariables = clone(moment.vars);
  turnCount = moment.turnCount;
  passageName = moment.passageName;
}

/** Attempt to move backwards in history. Returns whether the navigation was successful. */
export async function backward(): Promise<boolean> {
  if (index === 0) {
    return false;
  } else {
    if (config.stream) {
      const elts = Array.from(document.querySelectorAll(".brick-passage"));
      for (const elt of elts.slice(-2)) {
        elt.remove();
      }
    }
    index--;
    await loadCurrentMoment();
    saves.putHistory(historyIds, index, "active"); // Intentionally not awaited
    renderActive();
    return true;
  }
}

/** Attempt to move forward in history. Returns whether the navigation was successful. */
export async function forward(): Promise<boolean> {
  if (index === historyIds.length - 1) {
    return false;
  } else {
    index++;
    await loadCurrentMoment();
    saves.putHistory(historyIds, index, "active"); // Intentionally not awaited
    renderActive();
    return true;
  }
}

/** Navigate to the given passage, creating a new moment in the history. */
export async function navigate(passage: string | Passage) {
  passageName = typeof passage === "string" ? passage : passage.name;

  // clear moments past the current index
  historyIds.length = index + 1;
  historyMoments.length = index + 1;

  const newMoment = {
    passageName,
    timestamp: Date.now(),
    turnCount,
    vars: clone(storyVariables),
  };
  historyMoments.push(newMoment);
  historyIds.push(await saves.putMoment(newMoment));
  index++;
  saves.putHistory(historyIds, index, "active"); // Intentionally not awaited
  renderActive();
}

/** Render the active moment. */
function renderActive() {
  const psg = passages.get(passageName);
  if (!psg) {
    throw new Error(`Couldn't find passage "${passageName}"`);
  }

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
  const header = passages.get("StoryHeader");
  const footer = passages.get("StoryFooter");
  if (header) render(article, header);
  render(article, psg);
  if (footer) render(article, footer);
  mainElement.append(article);
  article.scrollIntoView();
  setTimeout(() => article.classList.remove("brick-transparent"), 40);
}

/** Restart the game (by clearing the active slot then reloading the page). */
export function restart() {
  saves.removeActiveHistory();
  window.location.reload();
}

export function redo() {
  for (const elt of document.querySelectorAll(".brick-macro-do")) {
    elt.dispatchEvent(new CustomEvent("brick-redo"));
  }
}
