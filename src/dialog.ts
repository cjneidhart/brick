import * as engine from "./engine";
import { get as getPassage } from "./passages";
import { render } from "./renderer";
import type { History } from "./saves";
import * as saves from "./saves";
import { getElementById, makeElement } from "./util";

let dialogElement: HTMLDialogElement;
let titleElt: HTMLElement;
let modalBody: HTMLElement;

export function init() {
  const maybeDialog = getElementById("brick-dialog");
  if (maybeDialog instanceof HTMLDialogElement) {
    dialogElement = maybeDialog;
  } else {
    throw new Error("#brick-dialog was not a <dialog> element");
  }
  reset();
  dialogElement.addEventListener("click", (event) => {
    const rect = dialogElement.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    const inDialog =
      rect.top <= y && y <= rect.top + rect.height && rect.left <= x && x <= rect.left + rect.width;
    if (!inDialog) {
      dialogElement.close();
    }
  });
}

export function reset() {
  dialogElement.innerHTML = "";
  dialogElement.className = "";

  titleElt = makeElement("h1");
  const modalHeader = makeElement("div", {}, titleElt);

  modalBody = makeElement("div");
  dialogElement.append(modalHeader, modalBody);
}

export function showPassage(passageName: string) {
  const passage = getPassage(passageName);
  if (!passage) {
    throw new Error(`Passage not found: ${passageName}`);
  }

  reset();

  titleElt.append(passageName);
  render(modalBody, passage);

  dialogElement.showModal();
}

export async function showSavesMenu() {
  reset();
  titleElt.append("Saves");
  modalBody.append("Loading...");
  dialogElement.showModal();

  const histories = await saves.getAllHistories();
  histories.sort((a, b) => b.timestamp - a.timestamp);
  const saveListings = await Promise.all(histories.map(makeHistoryListing));

  modalBody.innerHTML = "";
  const saveList = makeElement("ul");
  modalBody.append(saveList);
  if (saveListings.length === 0) {
    saveList.append(
      makeElement("li", { class: "brick-saves-empty" }, makeElement("em", {}, "No saves found")),
    );
  } else {
    saveList.append(...saveListings);
  }

  const newSaveButton = makeElement("button", {}, "Save");
  newSaveButton.addEventListener("click", async () => {
    saveList.querySelector(".brick-saves-empty")?.remove();
    const history = await engine.saveToSlot();
    saveList.prepend(makeHistoryListing(history));
  });
  modalBody.append(newSaveButton);
}

function makeHistoryListing(history: History): HTMLLIElement {
  const time = new Date(history.timestamp).toLocaleString();
  const { id } = history;
  if (!id) {
    throw new Error("Tried to create a save menu entry for an unsaved History");
  }
  const button = makeElement("button", {}, "Load");
  button.addEventListener("click", async () => {
    dialogElement.close();
    if (!engine.loadFromSlot(id)) {
      throw new Error(`Could not load history #${id}`);
    }
  });
  return makeElement(
    "li",
    {},
    makeElement("div", {}, history.title, makeElement("br"), makeElement("small", {}, time)),
    button,
  );
}
