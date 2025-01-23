/**
 * @module dialog
 *
 * This module defines functions for working with Brick's dialog element.
 * It also defines the built-in dialogs, such as the Saves UI.
 */

import * as engine from "./engine";
import { localize } from "./localize";
import { renderPassage } from "./renderer";
import type { History } from "./saves";
import * as saves from "./saves";
import { getElementById, makeElement } from "./util";

let dialogElement: HTMLDialogElement;
let titleElt: HTMLElement;
let modalBody: HTMLElement;
let storyTitleSlug: string;

export function init(slug: string) {
  storyTitleSlug = slug;
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
  reset();

  titleElt.append(passageName);
  // TODO: pass temp vars to a dialog?
  renderPassage(modalBody, {}, passageName);

  dialogElement.showModal();
}

export async function showSavesMenu() {
  reset();
  titleElt.append(localize("savesDialog.title"));
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
      makeElement(
        "li",
        { class: "brick-saves-empty" },
        makeElement("em", {}, localize("savesDialog.empty")),
      ),
    );
  } else {
    saveList.append(...saveListings);
  }

  const div = makeElement("div", { class: "brick-saves-buttons" });
  renderSaveButtons(saveList, div);
  modalBody.append(div);
}

function renderSaveButtons(saveList: HTMLUListElement, buttons: HTMLDivElement) {
  const deleteButton = makeElement(
    "button",
    { class: "brick-ui-btn" },
    localize("savesDialog.deleteMode"),
  );
  deleteButton.addEventListener("click", () => {
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyLoadHandler);
      button.addEventListener("click", historyDeleteHandler);
      button.textContent = "Delete";
    }
    renderDeleteButtons(saveList, buttons);
  });

  const exportButton = makeElement(
    "button",
    { class: "brick-ui-btn" },
    localize("savesDialog.exportMode"),
  );
  exportButton.addEventListener("click", () => {
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyLoadHandler);
      button.addEventListener("click", historyExportHandler);
      button.textContent = localize("savesDialog.export");
    }
    renderExportButtons(saveList, buttons);
  });

  const fileInputElt = makeElement("input", { type: "file" });
  fileInputElt.addEventListener("change", async () => {
    if (!fileInputElt.files || fileInputElt.files.length === 0) {
      return;
    }
    const slot = await saves.importFile(fileInputElt.files[0]);
    dialogElement.close();
    await engine.loadFromSlot(slot);
  });
  const importButton = makeElement(
    "button",
    { class: "brick-ui-btn" },
    localize("savesDialog.import"),
  );
  importButton.addEventListener("click", () => fileInputElt.click());

  const newSaveButton = makeElement(
    "button",
    { class: "brick-ui-btn" },
    localize("savesDialog.newSave"),
  );
  newSaveButton.addEventListener("click", async () => {
    const history = await engine.saveToSlot();
    saveList.querySelector(".brick-saves-empty")?.remove();
    saveList.prepend(makeHistoryListing(history));
  });

  buttons.innerHTML = "";
  buttons.append(deleteButton, exportButton, importButton, newSaveButton);
}

function renderDeleteButtons(saveList: HTMLUListElement, buttons: HTMLDivElement) {
  const deleteAllButton = makeElement(
    "button",
    { class: "brick-ui-btn", disabled: "" },
    localize("savesDialog.deleteAll"),
  );
  deleteAllButton.addEventListener("click", async function () {
    this.disabled = true;
    await saves.deleteNonActiveHistories();
    saveList.innerHTML = "";
    saveList.append(makeElement("li", {}, makeElement("em", {}, "No saves found")));
    renderSaveButtons(saveList, buttons);
  });
  setTimeout(() => {
    deleteAllButton.disabled = false;
  }, 2000);

  const cancelButton = makeElement("button", { class: "brick-ui-btn" }, localize("generic.cancel"));
  cancelButton.addEventListener("click", () => {
    const buttonText = localize("savesDialog.loadSave");
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyDeleteHandler);
      button.addEventListener("click", historyLoadHandler);
      button.textContent = buttonText;
    }
    renderSaveButtons(saveList, buttons);
  });

  buttons.innerHTML = "";
  buttons.append(deleteAllButton, cancelButton);
}

function renderExportButtons(saveList: HTMLUListElement, buttons: HTMLDivElement) {
  const cancelButton = makeElement("button", { class: "brick-ui-btn" }, localize("generic.cancel"));
  cancelButton.addEventListener("click", () => {
    const buttonText = localize("savesDialog.loadSave");
    for (const button of saveList.querySelectorAll("button")) {
      button.removeEventListener("click", historyExportHandler);
      button.addEventListener("click", historyLoadHandler);
      button.textContent = buttonText;
    }
    renderSaveButtons(saveList, buttons);
  });

  buttons.innerHTML = "";
  buttons.append(cancelButton);
}

function makeHistoryListing(history: History): HTMLLIElement {
  const time = new Date(history.timestamp).toLocaleString();
  const { id } = history;
  if (!id) {
    throw new Error("Tried to create a save menu entry for an unsaved History");
  }
  const button = makeElement(
    "button",
    { class: "brick-ui-btn", "data-brick-history-id": String(id) },
    localize("savesDialog.loadSave"),
  );
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
    throw new Error(`Tried to load invalid ID "${this.dataset.brickHistoryId}"`);
  }
  dialogElement.close();
  if (!(await engine.loadFromSlot(id))) {
    throw new Error(`Could not load history #${id}`);
  }
}

async function historyDeleteHandler(this: HTMLButtonElement) {
  const id = Number(this.dataset.brickHistoryId);
  if (id !== id) {
    throw new Error(`Tried to delete invalid ID "${this.dataset.brickHistoryId}"`);
  }
  await saves.deleteHistory(id);
  const saveList = this.parentElement?.parentElement;
  this.parentElement?.remove();
  if (saveList && saveList.childElementCount === 0) {
    saveList.append(
      makeElement(
        "li",
        { class: "brick-saves-empty" },
        makeElement("em", {}, localize("savesDialog.empty")),
      ),
    );
  }
}

async function historyExportHandler(this: HTMLButtonElement) {
  const id = Number(this.dataset.brickHistoryId);
  if (Number.isNaN(id)) {
    throw new Error(`Tried to export invalid ID "${this.dataset.brickHistoryId}"`);
  }
  const history = await saves.exportHistory(id);
  // Format the date as "YYYYMMDD-hhmmss"
  const timestamp = new Date(history.timestamp)
    .toISOString()
    .replace(/-|:|\..*/g, "")
    .replace("T", "-");
  const filename = `${storyTitleSlug}-${timestamp}.json`;
  // 2024, and creating a fake anchor is still the only way to do this
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(history)], { type: "application/json" }),
  );
  const anchor = makeElement("a", { download: filename, href: url });
  // document.body.append(anchor);
  anchor.click();
  // anchor.remove();
  URL.revokeObjectURL(url);
}

export function showRestartPrompt() {
  reset();
  dialogElement.classList.add("brick-restart");
  titleElt.textContent = "Restart";
  modalBody.append(makeElement("p", {}, localize("misc.restartConfirmation")));
  const restartButton = makeElement(
    "button",
    { class: "brick-ui-btn" },
    localize("generic.restart"),
  );
  restartButton.addEventListener("click", engine.restart);

  const closeButton = makeElement("button", { class: "brick-ui-btn" }, localize("generic.cancel"));
  closeButton.addEventListener("click", () => dialogElement.close());

  modalBody.append(restartButton, closeButton);

  dialogElement.showModal();
}
