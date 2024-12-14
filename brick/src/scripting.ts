/**
 * @module scripting
 *
 * This module defines the functions and values that should be available to
 * author-executed code. It's also where most type-checking occurs.
 */

import config from "./config";
import { showPassage } from "./dialog";
import { backward, forward, redo, storyVariables, tempVariables } from "./engine";
import * as passages from "./passages";
import * as util from "./util";

/** This is defined in `build.js` */
declare const BRICK_VERSION: Record<string, unknown>;

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = {
  BRICK_VERSION,
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
  config,
  Dialog: {
    showPassage,
  },
  passages,
  clone: util.clone,
  either(values: unknown): unknown {
    if (arguments.length !== 1) {
      throw new Error("either(): exactly one argument required");
    }
    if (typeof values !== "object" || values === null) {
      throw new Error("either(): first argument was not an array");
    }
    if (!("length" in values) || typeof values.length !== "number") {
      throw new Error("either(): first argument was not an array");
    }
    return util.either(values as ArrayLike<unknown>);
  },
  enumerate: util.enumerate,
  makeElement: util.makeElement,
  numberRange: util.numberRange,
  randomInt(max: unknown): number {
    if (arguments.length !== 1) {
      throw new Error("randomInt: exactly 1 argument required");
    }
    if (typeof max !== "number") {
      throw new Error("randomInt: argument must be a number");
    }
    return util.randomInt(max);
  },
  slugify: util.slugify,
};
BrickPublic.BRICK_VERSION.toString = function () {
  return this.version as string;
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
