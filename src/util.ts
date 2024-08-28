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
