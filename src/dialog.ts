import * as bootstrap from "bootstrap";
import * as engine from "./engine";
import { get as getPassage } from "./passages";
import { render } from "./renderer";
import { clearSlot, slotTitles } from "./saves";
import { getElementById, makeElement } from "./util";

const modalElement = getElementById("brick-dialog");
let titleElt: Element;
let modalBody: Element;
reset();
const bsModal = new bootstrap.Modal(modalElement);

export function reset() {
  modalElement.innerHTML = "";

  titleElt = makeElement("h1", { class: "modal-title fs-4" });
  const closeButton = makeElement("button", {
    type: "button",
    class: "btn-close",
    "data-bs-dismiss": "modal",
    "aria-label": "Close",
  });
  const modalHeader = makeElement("div", { class: "modal-header" }, titleElt, closeButton);

  modalBody = makeElement("div", { class: "modal-body" });

  const content = makeElement("div", { class: "modal-content" }, modalHeader, modalBody);
  const dialog = makeElement("div", { class: "modal-dialog" }, content);
  modalElement.append(dialog);
}

export function showPassage(passageName: string) {
  const passage = getPassage(passageName);
  if (!passage) {
    throw new Error(`Passage not found: ${passageName}`);
  }

  reset();

  titleElt.append(passageName);
  render(modalBody, passage.content);

  bsModal.show();
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

  bsModal.show();
}

function updateSaveMenuRow(slotNumber: number, row: HTMLTableRowElement) {
  const slotTitle = slotTitles[slotNumber];
  const saveLoadButton = makeElement("button", { type: "button", class: "btn btn-primary" });
  const deleteButton = makeElement("button", { type: "button", class: "btn btn-danger" }, "Delete");
  row.innerHTML = "";
  row.append(makeElement("th", { class: "text-center", scope: "row" }, String(slotNumber + 1)));
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
    row.append(makeElement("td", { class: "text-secondary" }, "Empty"));
    saveLoadButton.innerText = "Save";
    saveLoadButton.addEventListener("click", () => {
      engine.saveToSlot(slotNumber);
      updateSaveMenuRow(slotNumber, row);
    });
  }
  row.append(makeElement("td", { class: "text-end" }, deleteButton));
}
