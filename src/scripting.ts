import Config from "./config";
import { showPassage } from "./dialog";
import { backward, forward, redo, storyVariables, tempVariables } from "./engine";
import * as passages from "./passages";
import * as Util from "./util";

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = Object.freeze({
  forward,
  backward,
  redo,
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
});

const envKeys = ["Brick", "Config", "Dialog", "Passages", "Util"];

const envValues = [
  Object.freeze({
    forward,
    backward,
    redo,
    get vars() {
      return storyVariables;
    },
    get temp() {
      return tempVariables;
    },
  }),
  Object.freeze(Config),
  Object.freeze({ showPassage }),
  Object.freeze({ get: passages.get }),
  Object.freeze(Util),
];

export function evalJavaScript(js: string): unknown {
  console.log(js);
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
