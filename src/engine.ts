import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";

const mainElt = document.getElementById("passages") ||
  (() => {
    throw new Error("No #passages element found");
  })();

const HISTORY_LENGTH = 5;

interface Moment {
  passageName: string;
  state: {
    [key: string]: any;
  };
}

export function navigate(passage: string | Passage) {
  const psg = typeof passage === 'string' ? getPassage(passage) : passage;
  if (typeof psg === 'undefined') {
    throw new Error(`Couldn't find passage "${passage}"`);
  }
  mainElt.innerHTML = "";
  render(mainElt, psg.content);
}
