import levenshtein from "js-levenshtein";
import { warnOnce } from "./error";

const DELETED_CHARS = new Set<string>("'\",()[]{}.!`?");

/** Convert a string into a "slug" which is easier to use within CSS
 * Example: "The Iron Giant" becomes "the-iron-giant" */
export function slugify(input: string): string {
  return Array.from(input)
    .map((c) => {
      if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) {
        return c;
      } else if ((c >= "A" && c <= "Z") || c > "\x7F") {
        return c.toLowerCase();
      } else if (DELETED_CHARS.has(c)) {
        return "";
      } else {
        return "-";
      }
    })
    .join("")
    .replace(/-+/g, "-");
}

/** Count how many times `substring` occurs in `source` */
export function countSubstrings(source: string, substring: string): number {
  let index = -1;
  let total = 0;
  while (true) {
    index = source.indexOf(substring, index + 1);
    if (index === -1) {
      break;
    } else {
      total++;
    }
  }
  return total;
}

/** Perform a deep clone of a given object */
export function clone<T>(original: T): T {
  // TODO: circular reference detection
  switch (typeof original) {
    case "bigint":
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return original;

    case "symbol":
      throw new Error("Symbols cannot be cloned");

    case "function":
      throw new Error("Functions cannot be cloned");

    case "object":
      if (original === null) {
        return original;
      } else if ("clone" in original && typeof original.clone === "function") {
        return original.clone();
      } else if (original instanceof Array) {
        return original.map(clone) as T;
      } else if (original instanceof Date) {
        return new Date(original) as T;
      } else if (original instanceof Map) {
        const newMap = new Map();
        for (const [k, v] of original) {
          newMap.set(clone(k), clone(v));
        }
        return newMap as T;
      } else if (original instanceof RegExp) {
        return new RegExp(original) as T;
      } else if (original instanceof Set) {
        const newSet = new Set();
        for (const val of original) {
          newSet.add(clone(val));
        }
        return newSet as T;
      } else if (original instanceof Boolean) {
        warnOnce("boxedBoolean");
        return original;
      } else if (original instanceof Number) {
        warnOnce("boxedNumber");
        return original;
      } else if (original instanceof String) {
        warnOnce("boxedString");
        return original;
      } else {
        // generic object
        const prototype = Object.getPrototypeOf(original);
        if (prototype !== null && prototype !== Object.prototype) {
          throw new Error(
            "Can't clone an object with an unknown prototype and no `.clone()` method",
          );
        }
        const newObj: Record<string, unknown> = Object.create(prototype);
        for (const key in original) {
          newObj[key] = clone(original[key]);
        }
        return newObj as T;
      }

    default:
      throw new Error(`Unknown type: ${typeof original}`);
  }
}

export function either<T>(values: ArrayLike<T>): T {
  if (values.length < 1) {
    throw new Error("either: array is empty");
  }
  return values[randomInt(values.length)];
}

/** Similar to `document.getElementById`, but throws an error if the element wasn't found. */
export function getElementById(elementId: string): HTMLElement {
  const elt = document.getElementById(elementId);
  if (!elt) {
    throw new Error(`No element with id "${elementId}" found`);
  }
  return elt;
}

export function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

let idCounter = 0;

/** Return a unique identifier */
export function uniqueId(): string {
  return `brick-unique-id-${idCounter++}`;
}

/** Create a new {@link HTMLElement}. */
export function makeElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes?: Record<string, string>,
  ...childNodes: (Node | string)[]
): HTMLElementTagNameMap[K];
export function makeElement(
  tagName: string,
  attributes?: Record<string, string>,
  ...childNodes: (Node | string)[]
): HTMLElement;
export function makeElement(
  tagName: string,
  attributes: Record<string, string> = {},
  ...childNodes: (Node | string)[]
): HTMLElement {
  const element = document.createElement(tagName);
  for (const attr in attributes) {
    element.setAttribute(attr, attributes[attr]);
  }
  element.append(...childNodes);

  return element;
}

/** Assert that a value is a string */
export function assertString(maybeString: unknown): asserts maybeString is string {
  if (typeof maybeString !== "string") {
    throw new Error(`Expected string, instead received a ${typeof maybeString}`);
  }
}

/** Return an iterator, similar to Python's `range()` */
export function* numberRange(
  startOrStop: number,
  stop?: number,
  step = 1,
): Generator<number, void, void> {
  let nextValue: number;
  if (typeof stop === "undefined") {
    nextValue = 0;
    stop = startOrStop;
  } else {
    nextValue = startOrStop;
  }

  if (step > 0) {
    while (nextValue < stop) {
      yield nextValue;
      nextValue += step;
    }
  } else {
    while (nextValue > stop) {
      yield nextValue;
      nextValue += step;
    }
  }
}

/**
 * Return an iterator that yields 2-element arrays, where the first element is
 * a count and the second element is yielded by `iterable`.
 */
export function* enumerate<T>(
  iterable: Iterable<T>,
  start = 0,
): Generator<[number, T], void, void> {
  let i = start;
  for (const value of iterable) {
    yield [i, value];
    i++;
  }
}

/**
 * An alternative to the `String` constructor, with special
 * behavior for `Array`s. More special-cases may be added in the future.
 */
export function stringify(value?: unknown): string {
  if (arguments.length === 0) {
    return "";
  }

  if (
    value instanceof Array &&
    !(Symbol.toPrimitive in value) &&
    value.toString === Array.prototype.toString
  ) {
    return `[${value.join(", ")}]`;
  }

  return String(value);
}

export function closestString(target: string, guesses: string[], threshold?: number) {
  threshold ??= target.length * 0.4;
  let bestDistance = Infinity;
  let bestGuess: string | undefined = undefined;
  for (const guess of guesses) {
    const distance = levenshtein(target, guess);
    if (distance < threshold && distance < bestDistance) {
      bestDistance = distance;
      bestGuess = guess;
    }
  }
  return bestGuess;
}

/** Return a Proxy around `obj`. When an unknown property of `obj` is read
 * a warning will be issued. */
export function addTypoChecking<T extends object>(
  obj: T,
  messageGenerator?: (name: string, bestGuess?: string) => string,
): T {
  messageGenerator ??= (name, bestGuess) =>
    `Unknown property "${name}". Did you mean "${bestGuess}"?`;
  const handler = {
    get(target: object, prop: string | symbol, receiver: object) {
      if (prop in receiver || typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }

      // Collect all string keys of `receiver` and its prototypes, regardless
      // of their enumerability.
      const allKeys = Object.getOwnPropertyNames(receiver);
      let prototype = Object.getPrototypeOf(receiver);
      while (prototype) {
        allKeys.push(...Object.getOwnPropertyNames(prototype));
        prototype = Object.getPrototypeOf(prototype);
      }

      const bestGuess = closestString(prop, allKeys);
      if (bestGuess) {
        console.warn(messageGenerator(prop, bestGuess));
      }

      return Reflect.get(target, prop, receiver);
    },
  };
  return new Proxy(obj, handler) as T;
}
