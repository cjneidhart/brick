const DELETED_CHARS = new Set<string>();
DELETED_CHARS.add("'");
DELETED_CHARS.add('"');
DELETED_CHARS.add(",");
DELETED_CHARS.add("(");
DELETED_CHARS.add(")");
DELETED_CHARS.add("[");
DELETED_CHARS.add("]");
DELETED_CHARS.add("{");
DELETED_CHARS.add("}");
DELETED_CHARS.add(".");
DELETED_CHARS.add("!");
DELETED_CHARS.add("`");
DELETED_CHARS.add("?");

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

/**
 * Similar to `document.getElementById`, but throws an error if the element wasn't found.
 */
export function getElementById(elementId: string): Element {
  const elt = document.getElementById(elementId);
  if (!elt) {
    throw new Error(`No element with id '${elementId} found`);
  }
  return elt;
}
