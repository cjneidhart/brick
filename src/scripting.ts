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
});

export function evalJavaScript(js: string): unknown {
  const fn = new Function(`'use strict';${js}`);
  return fn();
}

export function evalExpression(js: string): unknown {
  return evalJavaScript("return " + js);
}

export function evalAssign(place: string, value: unknown) {
  const fn = new Function(`"use strict"; ${place} = arguments[0]`);
  fn(value);
}
