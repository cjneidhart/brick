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
    let psgName: string;
    if (args.length !== 1) {
      throw new Error("@include must be called with 1 argument");
    } else {
      if (typeof args[0] !== 'string') {
        throw new Error("@include: first arg (passage name) must be a string");
      }
      psgName = args[0];
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
