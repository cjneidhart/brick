import { Moment } from "./engine";
import { storyTitle } from "./main";
import { slugify } from "./util";

export interface SaveState {
  history: Moment[];
  index: number;
}

interface SerializeDefinition {
  constructor: Function;
  name: string;
  serialize: Function;
  deserialize: Function;
}

let prefix: string;
let sm: Storage;
export let slotTitles: (string | null)[];

const specialClasses: SerializeDefinition[] = [];

addSerializer(
  Date,
  undefined,
  (date: Date) => date.valueOf(),
  (value: number) => new Date(value),
);
addSerializer(Map, undefined, Array.from, (plain: [unknown, unknown][]) => new Map(plain));
addSerializer(
  RegExp,
  undefined,
  (value: RegExp) => [value.source, value.flags],
  (plain: [string, string]) => new RegExp(...plain),
);
addSerializer(Set, undefined, Array.from, (plain: unknown[]) => new Set(plain));

export function addSerializer(
  constructor: unknown,
  name?: unknown,
  serialize?: unknown,
  deserialize?: unknown,
) {
  if (typeof constructor !== "function") {
    throw new Error("addSerializer: `constructor` must be a function");
  }
  if (name === undefined) {
    name = constructor.name;
  }
  if (typeof name !== "string") {
    throw new Error("addSerializer: `name` must be undefined or a string");
  }
  if (serialize === undefined) {
    const c = constructor as unknown as Record<string, unknown>;
    serialize = c.serialize;
  }
  if (typeof serialize !== "function") {
    throw new Error("addSerializer: `serialize` must be undefined or a string");
  }
  if (deserialize === undefined) {
    const c = constructor as unknown as Record<string, unknown>;
    deserialize = c.deserialize;
  }
  if (typeof deserialize !== "function") {
    throw new Error("addSerializer: `deserialize` must be undefined or a string");
  }
  if (specialClasses.some((specialClass) => specialClass.name === name) || name === "undefined") {
    throw new Error(`addSerializer: "${name}" has already been registered`);
  }
  specialClasses.push({
    constructor,
    name,
    serialize,
    deserialize,
  });
}

export function init() {
  // TODO: add IFID
  prefix = `brick.${slugify(storyTitle)}`;
  sm = window.localStorage;
  slotTitles = JSON.parse(sm.getItem(prefix + ".slotTitles") || "[]");
  if (slotTitles.length < 8) {
    slotTitles.length = 8;
    slotTitles.fill(null);
  }
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

export function saveToSlot(slot: number, state: SaveState) {
  sm.setItem(prefix + ".slot-" + String(slot), JSON.stringify(state, saveReplacer));
  const title = state.history[state.index].passageName;
  slotTitles[slot] = title;
  sm.setItem(prefix + ".slotTitles", JSON.stringify(slotTitles));
}

export function loadFromSlot(slot: number): SaveState | undefined {
  return load(prefix + ".slot-" + String(slot));
}

export function clearSlot(slot: number) {
  sm.removeItem(prefix + ".slot-" + String(slot));
  slotTitles[slot] = null;
  sm.setItem(prefix + ".slotTitles", JSON.stringify(slotTitles));
}

function load(key: string): SaveState | undefined {
  const json = sm.getItem(key);
  return json ? JSON.parse(json, loadReplacer) : undefined;
}

function loadReplacer(_key: string, value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "string") {
    if (value[0] === "!brick-revive:undefined") {
      return undefined;
    } else if (value[0].startsWith("!brick-revive:")) {
      if (value.length !== 2) {
        throw new Error("malformed save data");
      }
      const defn = specialClasses.find((defn) => defn.name === value[0].substring(14));
      if (!defn) {
        throw new Error("malformed save data");
      }
      return defn.deserialize(value[1]);
    } else if (/^!{2,}brick-revive:/.test(value[0])) {
      value[0] = value[0].substring(1);
    }
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
      throw new Error(`Cannot serialize a ${typeof value}`);
    case "undefined":
      return ["!brick-revive:undefined"];
    case "object": {
      if (value === null) {
        return null;
      }
      if (Array.isArray(value)) {
        if (typeof value[0] === "string" && /^!+brick-revive:/.test(value[0])) {
          return ["!" + value[0], ...value.slice(1)];
        } else {
          return value;
        }
      }
      for (const defn of specialClasses) {
        if (value instanceof defn.constructor) {
          return [`!brick-revive:${defn.name}`, defn.serialize(value)];
        }
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== null && proto !== Object.prototype) {
        throw new Error("Can't serialize an object with an unknown prototype");
      }
      return value;
    }
  }
}
