/**
 * @module saves
 *
 * This is the main abstraction layer for saving to a user's storage.
 * Brick uses IndexedDB for its saves, which has many advantages over the traditional localStorage:
 * - Most primitives and objects are serialized automatically, unlike using JSON.stringify.
 * - Autoincrementing key generators means we don't have to create our own unique keys.
 * - Separate stores makes it easy to keep things type-safe
 *
 * The main cost for all this is that all operations are asynchronous.
 * Additionally, we still have to do extra work to serialize custom classes.
 *
 * See also:
 * - https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
 * - https://www.npmjs.com/package/idb
 */

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

export interface MomentSerialized {
  passageName: string;
  timestamp: number;
  turnCount: number;
  vars: Record<string, unknown>;
}

export interface HistorySerialized {
  index: number;
  timestamp: number;
  title: string;
  moments: MomentSerialized[];
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

  await cullUnusedMoments();
}

export function finish() {
  db?.close();
}

/**
 * If storage is too high, delete any moments in IDB that
 * aren't referenced by any history.
 */
async function cullUnusedMoments(): Promise<void> {
  const transaction = db.transaction(db.objectStoreNames, "readwrite");
  const momentStore = transaction.objectStore("moments");
  const momentCount = await momentStore.count();
  // TODO investigate better quotas, like maybe `navigator.storage.estimate()`
  if (momentCount > 1000) {
    const histories = await transaction.objectStore("histories").getAll();
    const momentsToKeep = new Set<number>();
    for (const history of histories) {
      for (const id of history.momentIds) {
        momentsToKeep.add(id);
      }
    }

    const deletePromises = [];
    for await (const cursor of momentStore) {
      if (!momentsToKeep.has(cursor.key)) {
        deletePromises.push(cursor.delete());
      }
    }
    await Promise.all(deletePromises);
  }
  await transaction.done;
}

/** Retrieve a moment from the database. Throws if the moment was not found. */
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
    vars: replaceSaveObject(moment.vars, false) as Record<string, unknown>,
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

/** Return a given history as a JSON-stringifiable object */
export async function exportHistory(slot: number): Promise<HistorySerialized> {
  // TODO This current implementation round-trips through the serialization process.
  // We could potentially speed this up by converting straight from IDB to JSON.
  const maybeHistory = await getHistory(slot);
  if (!maybeHistory) {
    throw new Error(`No history in slot ${slot}`);
  }
  const history = {
    index: maybeHistory.index,
    timestamp: maybeHistory.timestamp,
    title: maybeHistory.title,
    moments: await Promise.all(
      maybeHistory.momentIds.map(async (id) => {
        const moment = (await getMoment(id)) as MomentSerialized;
        moment.vars = replaceSaveObject(moment.vars, true) as Record<string, unknown>;
        return moment;
      }),
    ),
  };

  return history;
}

function importError(message: string): never {
  throw new Error(`Malformed save data: ${message}`);
}

export async function importFile(file: File): Promise<number> {
  const text = await file.text();
  const json: unknown = JSON.parse(text);
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    importError("history is not an object");
  } else if (!("index" in json)) {
    importError("Missing `index` property");
  } else if (typeof json.index !== "number") {
    importError("`index` property is not a number");
  } else if (!("timestamp" in json)) {
    importError("Missing `timestamp` property");
  } else if (typeof json.timestamp !== "number") {
    importError("`timestamp` property is not a number");
  } else if (!("title" in json)) {
    importError("Missing `title` property");
  } else if (typeof json.title !== "string") {
    importError("`title` property is not a string");
  } else if (!("moments" in json)) {
    importError("Missing `moments` property");
  } else if (!Array.isArray(json.moments)) {
    importError("`moments` property is not an array");
  }
  const { moments } = json;
  const momentIds = await Promise.all(
    moments.map((moment: unknown) => {
      if (typeof moment !== "object" || moment === null) {
        importError("one or more moments are not objects");
      } else if (!("passageName" in moment)) {
        importError("missing `passageName` property");
      } else if (typeof moment.passageName !== "string") {
        importError("`passageName` property is not a string");
      } else if (!("timestamp" in moment)) {
        importError("missing `timestamp` property");
      } else if (typeof moment.timestamp !== "number") {
        importError("`timestamp` property is not a number");
      } else if (!("turnCount" in moment)) {
        importError("missing `turnCount` property");
      } else if (typeof moment.turnCount !== "number") {
        importError("`turnCount` property is not a number");
      } else if (!("vars" in moment)) {
        importError("missing `vars` property");
      } else if (typeof moment.vars !== "object" || moment.vars === null) {
        importError("`vars` property is not an object");
      }
      return putMoment({
        passageName: moment.passageName,
        timestamp: moment.timestamp,
        turnCount: moment.turnCount,
        vars: reviveSaveObject(moment.vars as Record<string, unknown>) as Record<string, unknown>,
      });
    }),
  );
  const history = {
    index: json.index,
    timestamp: json.timestamp,
    title: json.title,
    momentIds,
  };
  return (await db.put("histories", history)) as number;
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
  if (
    authorClasses.some((specialClass) => specialClass.name === name) ||
    ["undefined", "neg-inf", "pos-inf", "nan", "Map", "Date", "Set", "RegExp"].includes(name)
  ) {
    throw new Error(`registerClass: "${name}" has already been registered`);
  }
  if (([Map, Set, Date, RegExp] as Function[]).includes(constructor)) {
    throw new Error(`${constructor.name} is already handled by Brick.`);
  }
  authorClasses.unshift({
    constructor,
    name,
    serialize,
    deserialize,
  });
}

function reviveSaveObject(object: Record<string, unknown>): unknown {
  for (const key in object) {
    const value = object[key];
    if (typeof value === "object" && value !== null) {
      object[key] = reviveSaveObject(value as Record<string, unknown>);
    }
  }
  if (object instanceof Array && typeof object[0] === "string") {
    if (object[0].startsWith("!brick-revive:")) {
      const tag = object[0].substring(14);
      if (![1, 2].includes(object.length)) {
        throw new Error("malformed save data");
      }
      return reviveSpecialObject(tag, object[1]);
    } else if (/^!{2,}brick-revive:/.test(object[0])) {
      object[0] = object[0].substring(1);
    }
  } else if (object instanceof Map) {
    const newMap = new Map<unknown, unknown>();
    for (let [key, value] of object as Map<unknown, unknown>) {
      if (typeof key === "object" && key) {
        key = reviveSaveObject(key as Record<string, unknown>);
      }
      if (typeof value === "object" && value) {
        value = reviveSaveObject(value as Record<string, unknown>);
      }
      newMap.set(key, value);
    }
    return newMap;
  } else if (object instanceof Set) {
    const newSet = new Set<unknown>();
    for (let value of object as Set<unknown>) {
      if (typeof value === "object" && value) {
        value = reviveSaveObject(value as Record<string, unknown>);
      }
      newSet.add(value);
    }
    return newSet;
  }
  return object;
}

/** Revive a object that had to be stored in a "!brick-revive:" array.
 * @param tag The first element of the array, with "!brick-revive" stripped off
 * @param data The second element of the array */
function reviveSpecialObject(tag: string, data: unknown) {
  switch (tag) {
    case "undefined":
      return undefined;
    case "pos-inf":
      return Infinity;
    case "neg-inf":
      return -Infinity;
    case "nan":
      return NaN;
    case "bigint":
      if ("BigInt" in window && typeof window.BigInt === "function") {
        return window.BigInt(data);
      } else {
        throw new Error("This browser does not support BigInts");
      }
    case "null-proto":
      return Object.assign(Object.create(null), data);
    case "Map":
      if (
        !Array.isArray(data) ||
        !data.every((entry) => Array.isArray(entry) && entry.length === 2)
      ) {
        throw new Error("Malformed save data. Could not revive a Map.");
      }
      return new Map(data);
    case "Set":
      if (!Array.isArray(data)) {
        throw new Error("Malformed save data. Could not revive a Set.");
      }
      return new Set(data);
    case "Date":
      if (typeof data !== "string") {
        throw new Error("Malformed save data. Could not revive a Date object.");
      }
      return new Date(data);
    case "RegExp": {
      if (!Array.isArray(data) || data.length !== 2 || !data.every((s) => typeof s === "string")) {
        throw new Error("Malformed save data. Could not revive a RegExp.");
      }
      const [source, flags] = data;
      return new RegExp(source, flags);
    }
  }
  const defn = authorClasses.find((defn) => defn.name === tag);
  if (!defn) {
    throw new Error(`Malformed save data. Unknown type "${tag}".`);
  }
  return defn.deserialize(data);
}

function replaceSaveValue(value: unknown, json: boolean): unknown {
  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "undefined":
      return json ? ["!brick-revive:undefined"] : value;
    case "number":
      if (json) {
        switch (value) {
          case Infinity:
            return ["!brick-revive:pos-inf"];
          case -Infinity:
            return ["!brick-revive:neg-inf"];
          default:
            return Number.isNaN(value) ? ["!brick-revive:nan"] : value;
        }
      } else {
        return value;
      }
    case "bigint":
      if (json) {
        return ["!brick-revive:bigint", String(value)];
      } else {
        return value;
      }
    case "function":
    case "symbol":
      throw new Error(`Cannot serialize a ${typeof value}`);
    case "object": {
      if (value === null) {
        return null;
      }
      return replaceSaveObject(value as Record<string, unknown>, json);
    }
  }
}

function replaceSaveObject(object: Record<string, unknown>, json: boolean): object {
  if (Array.isArray(object)) {
    if (typeof object[0] === "string" && /^!+brick-revive:/.test(object[0])) {
      return ["!" + object[0], ...object.slice(1)];
    } else {
      return object;
    }
  }

  if (object instanceof Map) {
    if (json) {
      const arr = [];
      for (const [key, value] of object as Map<unknown, unknown>) {
        arr.push([replaceSaveValue(key, json), replaceSaveValue(value, json)]);
      }
      return ["!brick-revive:Map", arr];
    } else {
      const newMap = new Map<unknown, unknown>();
      for (const [key, value] of object as Map<unknown, unknown>) {
        newMap.set(replaceSaveValue(key, json), replaceSaveValue(value, json));
      }
      return newMap;
    }
  }

  if (object instanceof Set) {
    if (json) {
      const arr = [];
      for (const item of object as Set<unknown>) {
        arr.push(replaceSaveValue(item, json));
      }
      return ["!brick-revive:Set", arr];
    } else {
      const newSet = new Set<unknown>();
      for (const value of object as Set<unknown>) {
        newSet.add(replaceSaveValue(value, json));
      }
      return newSet;
    }
  }

  if (object instanceof Date) {
    if (json) {
      return ["!brick-revive:Date", object.toJSON()];
    } else {
      return object;
    }
  }

  if (object instanceof RegExp) {
    if (json) {
      // NOTE: to match the structuredClone algorithm (used by IndexedDB)
      // we don't preserve the `.lastIndex` property.
      return ["!brick-revive:RegExp", [object.source, object.flags]];
    } else {
      return object;
    }
  }

  if (object instanceof Date || object instanceof RegExp) {
    return object;
  }

  for (const defn of authorClasses) {
    if (object instanceof defn.constructor) {
      return [`!brick-revive:${defn.name}`, replaceSaveValue(defn.serialize(object), json)];
    }
  }

  const proto = Object.getPrototypeOf(object);
  if (proto !== null && proto !== Object.prototype) {
    throw new Error("Can't serialize an object with an unknown prototype");
  }

  const newObj: Record<string, unknown> = {};
  for (const key in object) {
    newObj[key] = replaceSaveValue(object[key], json);
  }

  return proto === null ? ["!brick-revive:null-proto", newObj] : newObj;
}
