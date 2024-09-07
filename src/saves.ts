import { Moment } from "./engine";
import { storyTitle } from "./main";
import { slugify } from "./util";

interface SaveState {
  history: Moment[];
  index: number;
}

let prefix: string;
let sm: Storage;

export function init() {
  // TODO: add IFID
  prefix = `brick-${slugify(storyTitle)}`;
  sm = window.localStorage;
}

export function clearActive() {
  sm.removeItem(prefix + ".active");
}

export function saveActive(state: SaveState) {
  sm.setItem(prefix + ".active", JSON.stringify(state, saveReplacer));
}

export function loadActive(): SaveState | undefined {
  return load(prefix + ".active");
}

function load(key: string): SaveState | undefined {
  const json = sm.getItem(key);
  return json ? JSON.parse(json, loadReplacer) : undefined;
}

function loadReplacer(_key: string, value: unknown) {
  if (typeof value === "object" && value && "!brick-revive" in value) {
    console.warn(`Cannot yet handle ${value["!brick-revive"]} revivers`);
  }
  return value;
}

function saveReplacer(_key: string, value: unknown) {
  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
      return value;
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      throw new Error(`Cannot serialize a ${typeof value}`);
    case "object":
      if (value === null) {
        return null;
      } else if ("toJSON" in value && typeof value.toJSON === "function") {
        const json = value.toJSON();
        if (typeof json !== "string") {
          throw new Error("toJSON() did not return a string");
        }
        return json;
      } else if (value instanceof Array) {
        return value;
      } else if (value instanceof Date) {
        return { "!brick-revive": "date", value: value.valueOf() };
      } else if (value instanceof Map) {
        return { "!brick-revive": "map", entries: Array.from(value.entries()) };
      } else if (value instanceof RegExp) {
        return { "!brick-revive": "regexp", source: value.source, flags: value.flags };
      } else if (value instanceof Set) {
        return { "!brick-revive": "set", values: Array.from(value.values()) };
      } else {
        // generic object
        const proto = Object.getPrototypeOf(value);
        if (proto !== null && proto !== Object.prototype) {
          throw new Error(
            "Can't serialize an object with an unknown prototype and no `.toJSON()` method",
          );
        }
        return value;
      }
  }
}
