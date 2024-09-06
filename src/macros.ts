import { navigate } from "./engine";
import { NodeTemplate } from "./parser";
import { get as getPassage } from "./passages";
import { render } from "./renderer";
import { evalAssign, evalExpression } from "./scripting";
import { uniqueId } from "./util";

export interface MacroContext {
  content?: NodeTemplate[];
  name: string;
}

interface Macro {
  skipArgs?: boolean;
  handler: (this: MacroContext, ...args: unknown[]) => Node;
}

const macros = new Map<string, Macro>();

export function add(name: string, macro: Macro) {
  if (macros.has(name)) {
    console.warn(`Replacing an existing macro: "${name}"`);
  }
  macros.set(name, macro);
}

export function get(name: string): Macro | null {
  return macros.get(name) || null;
}

export function remove(name: string): boolean {
  return macros.delete(name);
}

add("include", {
  handler(...args: unknown[]) {
    const [psgName] = args;

    if (args.length !== 1) {
      throw new Error("@include must be called with 1 argument");
    }
    if (typeof psgName !== "string") {
      throw new Error("@include: first arg (passage name) must be a string");
    }

    const passage = getPassage(psgName);
    if (!passage) {
      throw new Error(`Passage not found: "${psgName}"`);
    }
    const div = document.createElement("div");
    render(div, passage.content);

    return div;
  },
});

add("", {
  handler(..._args) {
    // Pass: the args have already been evaluated by the renderer
    return new Text();
  },
});

add("linkTo", {
  handler(...args) {
    let psgName, linkText;
    if (args.length < 1 || args.length > 2) {
      throw new Error("@linkTo requires 1 or 2 arguments");
    } else if (args.length === 1) {
      psgName = linkText = args[0];
    } else {
      psgName = args[0];
      linkText = args[1];
    }
    if (typeof psgName !== "string") {
      throw new Error("@linkTo: first arg (passage name) must be a string");
    } else if (typeof linkText !== "string") {
      throw new Error("@linkTo: second arg (link text) must be a string");
    }

    const anchor = document.createElement("a");
    anchor.href = "#";
    anchor.classList.add(getPassage(psgName) ? "link-primary" : "link-danger");
    anchor.append(linkText);
    anchor.addEventListener("click", () => {
      navigate(psgName);
    });

    return anchor;
  },
});

add("linkReplace", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error("@linkReplace: requires exactly 1 argument");
    }
    const [linkText] = args;
    if (typeof linkText !== "string") {
      throw new Error("@linkReplace: first arg (link text) must be a string");
    }

    const anchor = document.createElement("a");
    anchor.href = "#";
    anchor.classList.add("link-primary");
    anchor.append(linkText);
    anchor.addEventListener("click", () => {
      const span = document.createElement("span");
      span.classList.add("macro-linkReplace", "fade-in", "opacity-0");
      render(span, this.content || "");
      anchor.after(span);
      anchor.remove();
      setTimeout(() => span.classList.remove("opacity-0"), 40);
    });

    return anchor;
  },
});

add("while", {
  skipArgs: true,
  handler(...args) {
    if (args.some((x) => typeof x !== "string")) {
      throw new Error("@while: received a non-string arg");
    }

    const conditionStr = (args as string[]).join(",");
    const frag = document.createDocumentFragment();
    const { content } = this;
    while (evalExpression(conditionStr)) {
      if (content) {
        render(frag, content);
      }
    }

    return frag;
  },
});

add("for", {
  skipArgs: true,
  handler(...args) {
    if (args.some((x) => typeof x !== "string")) {
      throw new Error("@for: received a non-string arg");
    }
    if (args.length !== 2) {
      throw new Error("@for: requires exactly 2 arguments");
    }

    const [varStr, iterableStr] = args as string[];
    if (!varStr.startsWith("$")) {
      throw new Error("@for: loop variable must be a story variable for now");
    }
    const place = `Brick.vars.${varStr.substring(1)}`;
    const iterable = evalExpression(iterableStr) as Iterable<unknown>;
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new Error("@for: Right-hand side must be an iterable value, such as an array");
    }
    const frag = document.createDocumentFragment();
    const { content } = this;
    for (const loopVal of iterable) {
      evalAssign(place, loopVal);
      if (content) {
        render(frag, content);
      }
    }

    return frag;
  },
});

add("checkBox", {
  skipArgs: true,
  handler(...args) {
    if (args.length !== 2) {
      throw new Error("@checkBox: requires 2 arguments");
    }
    if (args.some((arg) => typeof arg !== "string")) {
      throw new Error("@checkBox: both arguments must be strings");
    }

    const [place, labelExpr] = args as string[];
    const labelText = evalExpression(labelExpr);
    if (typeof labelText !== "string" && !(labelText instanceof Node)) {
      throw new Error("@checkBox: label must be a string or Node");
    }

    const initValue = evalExpression(place);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!initValue;
    cb.id = uniqueId();
    cb.classList.add("form-check-input");
    cb.addEventListener("change", () => evalAssign(place, cb.checked));

    const labelElt = document.createElement("label");
    labelElt.classList.add("form-check-label");
    labelElt.setAttribute("for", cb.id);
    labelElt.append(labelText);

    const div = document.createElement("div");
    div.classList.add("form-check");
    div.append(cb, labelElt);

    return div;
  },
});
