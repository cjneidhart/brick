const DELETED_CHARS = new Set<string>("'\",()[]{}.!`?");

export function slugify(input: string): string {
  return Array.from(input)
    .map((c) => {
      if (c >= "a" && c <= "z") {
        return c;
      } else if (c >= "A" && c <= "Z") {
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
      } else {
        // generic object
        const proto = Object.getPrototypeOf(original);
        if (proto !== null && proto !== Object.prototype) {
          throw new Error(
            "Can't clone an object with an unknown prototype and no `.clone()` method",
          );
        }
        const newObj: Record<string, unknown> = {};
        for (const key in original) {
          newObj[key] = clone(original[key]);
        }
        return newObj as T;
      }

    default:
      throw new Error(`Unknown type: ${typeof original}`);
  }
}

/** Similar to `document.getElementById`, but throws an error if the element wasn't found. */
export function getElementById(elementId: string): Element {
  const elt = document.getElementById(elementId);
  if (!elt) {
    throw new Error(`No element with id "${elementId}" found`);
  }
  return elt;
}
