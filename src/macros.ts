import { NodeTemplate } from "./parser";
import { get as getPassage } from "./passages";
import { render } from "./renderer";

const { document } = window;

interface MacroContext {
  contents?: NodeTemplate[];
  name: string;
}

interface Macro {
  handler: (this: MacroContext, ...args: unknown[]) => Node;
}

const macros = new Map<string, Macro>();

export function add(name: string, macro: Macro) {
  if (macros.has(name)) {
    throw new Error(`Macro already exists: "${name}"`);
  }
  return macros.set(name, macro);
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
  }
})
