import { Brick } from "./main";
import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";
import { clone, getElementById } from "./util";

interface Moment {
  passageName: string;
  vars: Record<string, unknown>;
}

let mainElt: Element;
let history: Moment[];
let index: number;

/** Initialize the engine */
export function init() {
  mainElt = getElementById("brick-main");
  history = [];
  index = -1;
}

/** Attempt to move backwards in history. Returns whether the navigation was successful. */
export function backward(): boolean {
  if (index === 0) {
    return false;
  } else {
    index--;
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
    vars: clone(Brick.vars),
  };
  history.push(newMoment);
  index++;

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

  Brick.vars = clone(moment.vars);

  mainElt.innerHTML = "";
  const newDiv = document.createElement("div");
  newDiv.classList.add("opacity-0", "fade-in");
  render(newDiv, psg.content);
  mainElt.append(newDiv);
  setTimeout(() => newDiv.classList.remove("opacity-0"), 40);
}
