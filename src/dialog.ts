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
    const r = dialogElement.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    const inDialog = r.top <= y && y <= r.top + r.height && r.left <= x && x <= r.left + r.width;
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
  dialogElement.classList.add("brick-saves-menu");
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

  const div = makeElement("div", { class: "brick-saves-buttons" });
  renderSaveButtons(saveList, div);
  modalBody.append(div);
}

function renderSaveButtons(saveList: HTMLUListElement, buttons: HTMLDivElement) {
  const deleteButton = makeElement("button", {}, "Delete");
  deleteButton.addEventListener("click", () => {
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyLoadHandler);
      button.addEventListener("click", historyDeleteHandler);
      button.innerText = "Delete";
    }
    renderDeleteButtons(saveList, buttons);
  });

  const exportButton = makeElement("button", {}, "Export");
  exportButton.addEventListener("click", () => alert("Not supported yet"));

  const importButton = makeElement("button", {}, "Import");
  importButton.addEventListener("click", () => alert("Not supported yet"));

  const newSaveButton = makeElement("button", {}, "Save");
  newSaveButton.addEventListener("click", async () => {
    const history = await engine.saveToSlot();
    saveList.querySelector(".brick-saves-empty")?.remove();
    saveList.prepend(makeHistoryListing(history));
  });

  buttons.innerHTML = "";
  buttons.append(deleteButton, exportButton, importButton, newSaveButton);
}

function renderDeleteButtons(saveList: HTMLUListElement, buttons: HTMLDivElement) {
  const deleteAllButton = makeElement("button", { disabled: "" }, "Delete All");
  deleteAllButton.addEventListener("click", async function () {
    this.disabled = true;
    await saves.deleteNonActiveHistories();
    saveList.innerHTML = "";
    saveList.append(makeElement("li", {}, makeElement("em", {}, "No saves found")));
    renderSaveButtons(saveList, buttons);
  });
  setTimeout(() => {
    deleteAllButton.disabled = false;
  }, 3000);

  const cancelButton = makeElement("button", {}, "Cancel");
  cancelButton.addEventListener("click", () => {
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyDeleteHandler);
      button.addEventListener("click", historyLoadHandler);
      button.innerText = "Load";
    }
    renderSaveButtons(saveList, buttons);
  });

  buttons.innerHTML = "";
  buttons.append(deleteAllButton, cancelButton);
}

function makeHistoryListing(history: History): HTMLLIElement {
  const time = new Date(history.timestamp).toLocaleString();
  const { id } = history;
  if (!id) {
    throw new Error("Tried to create a save menu entry for an unsaved History");
  }
  const button = makeElement("button", { "data-brick-history-id": String(id) }, "Load");
  button.addEventListener("click", historyLoadHandler);
  return makeElement(
    "li",
    {},
    makeElement("div", {}, history.title, makeElement("br"), makeElement("small", {}, time)),
    button,
  );
}

async function historyLoadHandler(this: HTMLButtonElement) {
  const id = Number(this.dataset.brickHistoryId);
  if (id !== id) {
    throw new Error(`Tried to load invalid ID "${this.dataset.brickHistoryId}`);
  }
  dialogElement.close();
  if (!(await engine.loadFromSlot(id))) {
    throw new Error(`Could not load history #${id}`);
  }
}

async function historyDeleteHandler(this: HTMLButtonElement) {
  const id = Number(this.dataset.brickHistoryId);
  if (id !== id) {
    throw new Error(`Tried to delete invalid ID "${this.dataset.brickHistoryId}`);
  }
  await saves.deleteHistory(id);
  const saveList = this.parentElement?.parentElement;
  this.parentElement?.remove();
  if (saveList && saveList.childElementCount === 0) {
    saveList.append(
      makeElement("li", { class: "brick-saves-empty" }, makeElement("em", {}, "No saves found")),
    );
  }
}
