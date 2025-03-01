/**
 * @module scripting
 *
 * This module defines the functions and values that should be available to
 * author-executed code. It's also where most type-checking occurs.
 */

import config from "./config";
import { showPassage } from "./dialog";
import * as engine from "./engine";
import { createGetter, createMacro } from "./macros";
import { importPassage } from "./modules";
import * as passages from "./passages";
import * as renderer from "./renderer";
import * as saves from "./saves";
import * as util from "./util";

/** This is defined in `build.js` */
declare const BRICK_VERSION: Record<string, unknown>;

declare global {
  interface Window {
    Brick: typeof BrickPublic;
    importPassage: (moduleName: unknown) => Promise<Record<string, unknown>>;
  }
}

/** The public API available to authors */
// TODO: type-checking
export const BrickPublic = {
  BRICK_VERSION,
  get constants() {
    return engine.constants;
  },
  engine: {
    forward: engine.forward,
    backward: engine.backward,
    redo: engine.redo,
    get vars() {
      return engine.storyVariables;
    },
    get temp() {
      return engine.tempVariables;
    },
  },
  config,
  dialog: {
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
    getOrThrow(name: unknown): passages.Passage {
      if (typeof name !== "string") {
        throw new Error("passages.get: expected a string");
      }
      return passages.getOrThrow(name);
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
  importPassage: function (moduleName: unknown): Promise<Record<string, unknown>> {
    if (arguments.length !== 1) {
      throw new TypeError("importPassage: must receive exactly one argument");
    }
    if (typeof moduleName !== "string") {
      throw new TypeError("importPassage: string expected");
    }
    return importPassage(moduleName);
  },
  clone: util.clone,
  createMacro,
  createGetter,
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
  makeElement(tagName: unknown, attributes: unknown, ...childNodes: unknown[]) {
    if (typeof tagName !== "string") {
      throw new TypeError(`makeElement: tagName must be a string`);
    }
    if (typeof attributes === "object" && attributes) {
      const allowedTypes = ["object", "string", "function"];
      for (const key in attributes) {
        const value = (attributes as Record<string, unknown>)[key];
        if (!value || !allowedTypes.includes(typeof value)) {
          throw new TypeError(
            `makeElement: attributes.${key} must be a string, object, or function`,
          );
        }
      }
    } else if (typeof attributes !== "undefined") {
      throw new TypeError(`makeElement: attributes must be an object or undefined`);
    }
    for (const childNode of childNodes) {
      if (!(typeof childNode === "string" || childNode instanceof Node)) {
        throw new TypeError(`makeElement: each child must be a string or Node`);
      }
    }
    return util.makeElement(
      tagName,
      attributes as util.Attributes,
      ...(childNodes as (string | Node)[]),
    );
  },
  numberRange: util.numberRange,
  passageName(): string {
    if (arguments.length !== 0) {
      throw new TypeError("passageName(): no arguments allowed");
    }
    return engine.activePassageName();
  },
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
  tags(): readonly string[] {
    if (arguments.length !== 0) {
      throw new TypeError("tags(): no arguments allowed");
    }
    const passage = passages.get(engine.activePassageName());
    return passage?.tags ?? [];
  },
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
  window.importPassage = BrickPublic.importPassage;
}

export function evalJavaScript(js: string, tempVars: Record<string, unknown>): unknown {
  const fn = new Function(...envKeys, "brickTempVarScope", `'use strict';${js}`);
  return fn(...envValues, tempVars);
}

export function evalExpression(js: string, tempVars: Record<string, unknown>): unknown {
  return evalJavaScript("return " + js, tempVars);
}

export function evalAssign(place: string, value: unknown, tempVars: Record<string, unknown>) {
  const fn = new Function(
    ...envKeys,
    "brickTempVarScope",
    `"use strict"; ${place} = arguments[arguments.length - 1]`,
  );
  fn(...envValues, tempVars, value);
}
