import { navigate } from "./engine";
import { NodeTemplate } from "./parser";
import { get as getPassage } from "./passages";
import { render } from "./renderer";

const { document } = window;

export interface MacroContext {
  content?: NodeTemplate[];
  name: string;
}

interface Macro {
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
  handler(...args: unknown[]): Node {
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
  handler(..._args): Node {
    // Pass: the args have already been evaluated by the renderer
    return new Text();
  },
});

add("linkTo", {
  handler(...args): Node {
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
  handler(...args): Node {
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
      span.classList.add("macro-linkReplace");
      render(span, this.content || "");
      anchor.after(span);
      anchor.remove();
    });

    return anchor;
  },
});
