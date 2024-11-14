import Config from "./config";
import { showPassage } from "./dialog";
import { backward, forward, redo, storyVariables, tempVariables } from "./engine";
import * as Passages from "./passages";
import * as Util from "./util";

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = {
  Engine: {
    forward,
    backward,
    redo,
    get vars() {
      return storyVariables;
    },
    get temp() {
      return tempVariables;
    },
  },
  Config,
  Dialog: {
    showPassage,
  },
  Passages,
  clone: Util.clone,
  enumerate: Util.enumerate,
  makeElement: Util.makeElement,
  numberRange: Util.numberRange,
  slugify: Util.slugify,
};

const envKeys = Object.keys(BrickPublic);
const envValues = Object.values(BrickPublic);

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
