// import * as bootstrap from "bootstrap";
import * as engine from "./engine";
import { get as getPassage } from "./passages";
import { render } from "./renderer";
import { clearSlot, slotTitles } from "./saves";
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
  // const closeButton = makeElement("button", {
  //   type: "button",
  //   class: "btn-close",
  //   "data-bs-dismiss": "modal",
  //   "aria-label": "Close",
  // });
  // const modalHeader = makeElement("div", { class: "modal-header" }, titleElt, closeButton);
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

export function showSavesMenu() {
  reset();

  titleElt.append("Saves");

  const tbody = makeElement("tbody", {});
  for (let i = 0; i < 8; i++) {
    const tr = makeElement("tr", {});
    updateSaveMenuRow(i, tr);
    tbody.append(tr);
  }

  const table = makeElement("table", { class: "table table-striped border" }, tbody);
  modalBody.append(table);

  dialogElement.classList.add("brick-saves");

  dialogElement.showModal();
}

function updateSaveMenuRow(slotNumber: number, row: HTMLTableRowElement) {
  const slotTitle = slotTitles[slotNumber];
  const saveLoadButton = makeElement("button", { type: "button", class: "brick-sidebar-btn" });
  const deleteButton = makeElement(
    "button",
    { type: "button", class: "brick-sidebar-btn" },
    "Delete",
  );
  row.innerHTML = "";
  row.append(makeElement("th", { scope: "row" }, String(slotNumber + 1)));
  row.append(makeElement("td", {}, saveLoadButton));
  if (typeof slotTitle === "string") {
    row.append(makeElement("td", {}, slotTitle));
    saveLoadButton.innerText = "Load";
    saveLoadButton.addEventListener("click", () => {
      engine.loadFromSlot(slotNumber);
      updateSaveMenuRow(slotNumber, row);
    });
    deleteButton.addEventListener("click", () => {
      clearSlot(slotNumber);
      updateSaveMenuRow(slotNumber, row);
    });
  } else {
    deleteButton.disabled = true;
    row.append(makeElement("td", { class: "brick-text-secondary" }, "Empty"));
    saveLoadButton.innerText = "Save";
    saveLoadButton.addEventListener("click", () => {
      engine.saveToSlot(slotNumber);
      updateSaveMenuRow(slotNumber, row);
    });
  }
  row.append(makeElement("td", {}, deleteButton));
}
