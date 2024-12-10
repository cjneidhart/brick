import en from "./locale/en.json";

const locale = en;

function indexObjByPath(obj: object, path: string): unknown {
  const keys = path.split(".");
  let currentValue: object = obj;
  let finalValue: unknown;
  for (const [idx, key] of keys.entries()) {
    if (!(key in currentValue)) {
      throw new Error(`Invalid key: ${keys.slice(0, idx + 1).join(".")}`);
    }
    const oldValue = currentValue as Record<string, object | string>;
    if (idx === keys.length - 1) {
      finalValue = oldValue[key];
    } else {
      if (typeof oldValue[key] !== "object" || oldValue[key] === null) {
        throw new Error(`"${keys.slice(0, idx + 1).join(".")}" is not an object`);
      }
      currentValue = oldValue[key];
    }
  }

  return finalValue;
}

export function localize(id: string, _opts?: Record<string, unknown>): string {
  let template: unknown;
  try {
    template = indexObjByPath(locale, id);
  } catch (error) {
    console.error(error);
  }

  return typeof template === "string" ? template : `{{${id}}}`;
}
