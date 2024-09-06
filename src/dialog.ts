import * as bootstrap from "bootstrap";
import { getElementById } from "./util";
import { get as getPassage } from "./passages";
import { render } from "./renderer";

const modalElement = getElementById("brick-dialog");
let titleElt: Element;
let modalBody: Element;
reset();
const bsModal = new bootstrap.Modal(modalElement);

export function reset() {
  modalElement.innerHTML = "";

  titleElt = document.createElement("h1");
  titleElt.classList.add("modal-title");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.classList.add("btn-close");
  closeButton.setAttribute("data-bs-dismiss", "modal");
  closeButton.setAttribute("aria-label", "Close");

  const modalHeader = document.createElement("div");
  modalHeader.classList.add("modal-header");
  modalHeader.append(titleElt, closeButton);

  modalBody = document.createElement("div");
  modalBody.classList.add("modal-body");

  const content = document.createElement("div");
  content.classList.add("modal-content");
  content.append(modalHeader, modalBody);

  const dialog = document.createElement("div");
  dialog.classList.add("modal-dialog");
  dialog.append(content);

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
