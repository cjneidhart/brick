import * as bootstrap from "bootstrap";
import { getElementById, makeElement } from "./util";
import { get as getPassage } from "./passages";
import { render } from "./renderer";

const modalElement = getElementById("brick-dialog");
let titleElt: Element;
let modalBody: Element;
reset();
const bsModal = new bootstrap.Modal(modalElement);

export function reset() {
  modalElement.innerHTML = "";

  titleElt = makeElement("h1", { class: "modal-title" });
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
