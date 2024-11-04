import { slugify } from "./util";
import * as idb from "idb";

/** A single entry within the history */
export interface Moment {
  /** The name of the active passage */
  readonly passageName: string;
  /** The time at which this moment was navigated to (forward/backward does not count) */
  readonly timestamp: number;
  /** The turn count (starting at 1) */
  readonly turnCount: number;
  /** The story variables */
  readonly vars: Record<string, unknown>;
}

export interface History {
  /** The ID used to look up this object in the database */
  id?: number | "active";
  /** The index of the active moment */
  readonly index: number;
  /** The IDs of all Moments in this History */
  readonly momentIds: number[];
  /** The timestamp at which this History was saved */
  readonly timestamp: number;
  /** The title to display in the saves menu */
  readonly title: string;
}

interface SerializeDefinition {
  constructor: Function;
  name: string;
  serialize: Function;
  deserialize: Function;
}

interface BrickSchema extends idb.DBSchema {
  histories: {
    key: number | "active";
    value: History;
  };
  moments: {
    key: number;
    value: Moment;
  };
}

let prefix: string;
let db: idb.IDBPDatabase<BrickSchema>;
export let slotTitles: (string | null)[];
const authorClasses: SerializeDefinition[] = [];

export async function init(storyTitle: string, ifid: string) {
  prefix = `brick.${slugify(storyTitle)}.${ifid}`;

  db = await idb.openDB<BrickSchema>(prefix, 1, {
    upgrade(db, _oldVersion, _newVersion, _transaction, _event) {
      db.createObjectStore("moments", { autoIncrement: true });
      db.createObjectStore("histories", { autoIncrement: true, keyPath: "id" });
    },
  });
}

export async function getMoment(id: number): Promise<Moment> {
  const moment = await db.get("moments", id);
  if (!moment) {
    throw new Error(`Could not load moment ${id}`);
  }
  return {
    ...moment,
    vars: reviveSaveObject(moment.vars) as Record<string, unknown>,
  };
}

export async function putMoment(moment: Moment): Promise<number> {
  const simpleMoment = {
    ...moment,
    vars: replaceSaveObject(moment.vars) as Record<string, unknown>,
  };
  return await db.put("moments", simpleMoment);
}

export async function getHistory(key: number | "active"): Promise<History | undefined> {
  return await db.get("histories", key);
}

/** Returns all histories, except the active one */
export async function getAllHistories(): Promise<History[]> {
  // every string key is greater than every number key in IDB
  return await db.getAll("histories", IDBKeyRange.upperBound(""));
}

export async function putHistoryActive(momentIds: number[], index: number, title: string) {
  const newHistory: History = { id: "active", momentIds, index, timestamp: Date.now(), title };
  await db.put("histories", newHistory);
}

export async function putHistory(
  momentIds: number[],
  index: number,
  title: string,
): Promise<History> {
  const newHistory: History = { momentIds, index, timestamp: Date.now(), title };
  newHistory.id = await db.put("histories", newHistory);
  return newHistory;
}

export async function deleteActiveHistory() {
  return await db.delete("histories", "active");
}

export async function deleteNonActiveHistories() {
  return await db.delete("histories", IDBKeyRange.upperBound(""));
}

export async function deleteHistory(id: number) {
  return await db.delete("histories", id);
}

export async function clearEverything() {
  await Promise.all([db.clear("histories"), db.clear("moments")]);
}

/**
 * Register a class in the save system.
 * @param constructor The class to register.
 * @param name A unique name to refer to the class by. Defaults to `constructor.name`
 * @param serialize A method which converts an object of this class to a JSON-stringifiable object
 * or array. Defaults to `constructor.serialize`.
 * @param deserialize A method which converts data from `serialize` back to an object of this
 * class. Defaults to `constructor.deserialize`.
 */
export function registerClass(
  constructor: unknown,
  serialize?: unknown,
  deserialize?: unknown,
  name?: string,
) {
  if (typeof constructor !== "function") {
    throw new Error("registerClass: `constructor` must be a function");
  }
  if (constructor === Array) {
    throw new Error('"Array" cannot be a registered class');
  }
  if (name === undefined) {
    name = constructor.name;
  }
  if (typeof name !== "string") {
    throw new Error("registerClass: `name` must be undefined or a string");
  }
  if (serialize === undefined) {
    const c = constructor as unknown as Record<string, unknown>;
    serialize = c.serialize;
  }
  if (typeof serialize !== "function") {
    throw new Error("registerClass: `serialize` must be undefined or a string");
  }
  if (deserialize === undefined) {
    const c = constructor as unknown as Record<string, unknown>;
    deserialize = c.deserialize;
  }
  if (typeof deserialize !== "function") {
    throw new Error("registerClass: `deserialize` must be undefined or a string");
  }
  if (authorClasses.some((specialClass) => specialClass.name === name) || name === "undefined") {
    throw new Error(`registerClass: "${name}" has already been registered`);
  }
  authorClasses.unshift({
    constructor,
    name,
    serialize,
    deserialize,
  });
}

function reviveSaveObject(object: Record<string, unknown>): unknown {
  for (const key in Object.keys(object)) {
    const value = object[key];
    if (typeof value === "object" && value !== null) {
      object[key] = reviveSaveObject(value as Record<string, unknown>);
    }
  }
  if (object instanceof Array && typeof object[0] === "string") {
    if (object[0].startsWith("!brick-revive:")) {
      const tag = object[0].substring(14);
      if (object.length !== 2) {
        throw new Error("malformed save data");
      }
      const defn = authorClasses.find((defn) => defn.name === tag);
      if (!defn) {
        throw new Error("malformed save data");
      }
      return defn.deserialize(object[1]);
    } else if (/^!{2,}brick-revive:/.test(object[0])) {
      object[0] = object[0].substring(1);
    }
  } else if (object instanceof Map) {
    const newMap = new Map<unknown, unknown>();
    for (let [key, value] of object as Map<unknown, unknown>) {
      if (typeof key === "object" && key) {
        key = replaceSaveObject(key as Record<string, unknown>);
      }
      if (typeof value === "object" && value) {
        value = replaceSaveObject(value as Record<string, unknown>);
      }
      newMap.set(key, value);
    }
    return newMap;
  } else if (object instanceof Set) {
    const newSet = new Set<unknown>();
    for (let value of object as Set<unknown>) {
      if (typeof value === "object" && value) {
        value = replaceSaveObject(value as Record<string, unknown>);
      }
      newSet.add(value);
    }
    return newSet;
  }
  return object;
}

function replaceSaveValue(value: unknown): unknown {
  switch (typeof value) {
    case "boolean":
    case "string":
    case "number":
    case "undefined":
    case "bigint":
      return value;
    case "function":
    case "symbol":
      throw new Error(`Cannot serialize a ${typeof value}`);
    case "object": {
      if (value === null) {
        return null;
      }
      return replaceSaveObject(value as Record<string, unknown>);
    }
  }
}

function replaceSaveObject(object: Record<string, unknown>): object {
  if (Array.isArray(object)) {
    if (typeof object[0] === "string" && /^!+brick-revive:/.test(object[0])) {
      return ["!" + object[0], ...object.slice(1)];
    } else {
      return object;
    }
  }

  if (object instanceof Map) {
    const newMap = new Map<unknown, unknown>();
    for (const [key, value] of object as Map<unknown, unknown>) {
      newMap.set(replaceSaveValue(key), replaceSaveValue(value));
    }
    return newMap;
  }

  if (object instanceof Set) {
    const newSet = new Set<unknown>();
    for (const value of object as Set<unknown>) {
      newSet.add(replaceSaveValue(value));
    }
    return newSet;
  }

  if (object instanceof Date || object instanceof RegExp) {
    return object;
  }

  for (const defn of authorClasses) {
    if (object instanceof defn.constructor) {
      return [`!brick-revive:${defn.name}`, replaceSaveValue(defn.serialize(object))];
    }
  }

  const proto = Object.getPrototypeOf(object);
  if (proto !== null && proto !== Object.prototype) {
    throw new Error("Can't serialize an object with an unknown prototype");
  }

  const newObj: Record<string, unknown> = {};
  for (const key in object) {
    newObj[key] = replaceSaveValue(object[key]);
  }

  return newObj;
}
