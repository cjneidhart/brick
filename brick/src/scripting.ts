/**
 * @module scripting
 *
 * This module defines the functions and values that should be available to
 * author-executed code. It's also where most type-checking occurs.
 */

import config from "./config";
import { showPassage } from "./dialog";
import { backward, constants, forward, redo, storyVariables, tempVariables } from "./engine";
import { createMacro } from "./macros";
import * as passages from "./passages";
import * as renderer from "./renderer";
import * as saves from "./saves";
import * as util from "./util";

/** This is defined in `build.js` */
declare const BRICK_VERSION: Record<string, unknown>;

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = {
  BRICK_VERSION,
  get constants() {
    return constants;
  },
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
  passages: {
    filter(predicate: unknown): passages.Passage[] {
      if (typeof predicate !== "function") {
        throw new Error("passages.filter: expected a function");
      }
      return passages.filter(predicate as (_: passages.Passage) => unknown);
    },
    find(predicate: unknown): passages.Passage | undefined {
      if (typeof predicate !== "function") {
        throw new Error("passages.find: expected a function");
      }
      return passages.find(predicate as (_: passages.Passage) => unknown);
    },
    get(name: unknown): passages.Passage | undefined {
      if (typeof name !== "string") {
        throw new Error("passages.get: expected a string");
      }
      return passages.get(name);
    },
    withTag(tag: unknown): passages.Passage[] {
      if (typeof tag !== "string") {
        throw new Error("passages.withTag: expected a string");
      }
      return passages.withTag(tag);
    },
  },
  saves: {
    registerClass: saves.registerClass,
  },
  clone: util.clone,
  createMacro,
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
  render: renderer.render,
  renderPassage: renderer.renderPassage,
  slugify: util.slugify,
};
BrickPublic.BRICK_VERSION.toString = function () {
  return this.version as string;
};
BrickPublic.BRICK_VERSION.time = new Date(BrickPublic.BRICK_VERSION.time as number);

let envKeys: string[];
let envValues: unknown[];

export function init() {
  envKeys = Object.keys(BrickPublic);
  envValues = Object.values(BrickPublic);
  window.Brick = BrickPublic;
}

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
