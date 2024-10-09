import Config from "./config";
import { showPassage } from "./dialog";
import { backward, forward, storyVariables, tempVariables } from "./engine";
import * as passages from "./passages";
import * as Util from "./util";

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = Object.freeze({
  forward,
  backward,
  Dialog: Object.freeze({
    showPassage,
  }),
  Passages: Object.freeze({
    get: passages.get,
  }),
  Util: Object.freeze(Util),
  get vars() {
    return storyVariables;
  },
  get temp() {
    return tempVariables;
  },
  redo: function (this: null) {
    const doElements = document.querySelectorAll(".brick-macro-do");
    for (const elt of doElements) {
      const event = new Event("brick-redo");
      elt.dispatchEvent(event);
    }
  },
});

const envKeys = ["Brick", "Config", "Dialog", "Passages", "Util"];

const envValues = [
  Object.freeze({
    forward,
    backward,
    get vars() {
      return storyVariables;
    },
    get temp() {
      return tempVariables;
    },
    redo: function (this: null) {
      for (const element of document.querySelectorAll(".brick-macro-redoable")) {
        element.dispatchEvent(new Event("brick-redo"));
      }
    },
  }),
  Object.freeze(Config),
  Object.freeze({ showPassage }),
  Object.freeze({ get: passages.get }),
  Object.freeze(Util),
];

export function evalJavaScript(js: string): unknown {
  const fn = new Function(...envKeys, `'use strict';${js}`);
  return fn(...envValues);
}

export function evalExpression(js: string): unknown {
  return evalJavaScript("return " + js);
}

export function evalAssign(place: string, value: unknown) {
  const fn = new Function(...envKeys, `"use strict"; ${place} = arguments[arguments.length - 1]`);
  fn(...envValues, value);
}
