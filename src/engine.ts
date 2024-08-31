import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";

const mainElt =
  document.getElementById("brick-main") ||
  (() => {
    throw new Error("No #brick-main element found");
  })();

interface Moment {
  passageName: string;
  state: Record<string, unknown>;
}

const history: Moment[] = [];
let index = -1;

/**
 * Attempt to move backwards in history. Returns whether the navigation was successful.
 */
export function backward(): boolean {
  if (index === 0) {
    return false;
  } else {
    index--;
    renderActive();
    return true;
  }
}

export function forward(): boolean {
  if (index === history.length - 1) {
    return false;
  } else {
    index++;
    renderActive();
    return true;
  }
}

/**
 * Navigate to the given passage, creating a new moment in the history.
 */
export function navigate(passage: string | Passage) {
  const passageName = typeof passage === 'string' ? passage : passage.name;

  // clear moments past the current index
  history.length = index + 1;

  const newMoment = {
    passageName,
    state: {},
  };
  history.push(newMoment);
  index++;

  renderActive();
}

/**
 * Render the active moment.
 */
function renderActive() {
  const moment = history[index];
  if (!moment) {
    throw new Error(`No active moment at index ${index}`);
  }

  const psg = getPassage(moment.passageName);
  if (!psg) {
    throw new Error(`Couldn't find passage "${moment.passageName}"`);
  }

  mainElt.innerHTML = "";
  render(mainElt, psg.content);
}
