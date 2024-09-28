import { navigate, tempVariables } from "./engine";
import { MacroTemplate, NodeTemplate } from "./parser";
import { get as getPassage, Passage } from "./passages";
import { render } from "./renderer";
import { evalAssign, evalExpression } from "./scripting";
import { makeElement, uniqueId } from "./util";

export enum LoopStatus {
  OUTSIDE_LOOP = 1,
  IN_LOOP,
  BREAKING,
  CONTINUING,
}

interface CapturedVar {
  name: string;
  value: unknown;
}

export class MacroContext {
  content?: NodeTemplate[];
  name: string;
  loopStatus: LoopStatus;
  parent?: MacroContext;
  captures?: CapturedVar[];

  constructor(name: string, parent?: MacroContext, content?: NodeTemplate[]) {
    this.name = name;
    this.loopStatus = parent?.loopStatus || LoopStatus.OUTSIDE_LOOP;
    this.content = content;
    if (parent?.captures) {
      this.captures = parent.captures;
    }
  }

  render(target: Element | DocumentFragment, input?: string | NodeTemplate[] | Passage) {
    input ||= this.content || [];
    switch (this.loopStatus) {
      case LoopStatus.OUTSIDE_LOOP:
        render(target, input, this);
        break;
      case LoopStatus.IN_LOOP:
        render(target, input, this);
        break;
      case LoopStatus.BREAKING:
      case LoopStatus.CONTINUING:
        // pass;
        break;
      default:
        throw new Error(`unknown loopStatus: "${this.loopStatus}"`);
    }
  }

  createCallback<F extends Function>(func: F): F {
    const context = this;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      if (!context.captures) {
        return func.apply(this, args);
      }
      const oldVals: Record<string, unknown> = {};
      for (const capture of context.captures) {
        // In case of repeats, avoid overwriting existing old value
        if (!(capture.name in oldVals)) {
          oldVals[capture.name] = tempVariables[capture.name];
        }
        tempVariables[capture.name] = capture.value;
      }

      let returnValue: unknown;
      try {
        returnValue = func.apply(this, args);
      } finally {
        Object.assign(tempVariables, oldVals);
      }

      return returnValue;
    };

    return wrapped as unknown as F;
  }
}

interface Macro {
  skipArgs?: boolean;
  trailingMacros?: string[];
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
    const [psgName, elementName] = args;

    if (args.length < 1 || args.length > 2) {
      throw new Error("@include must be called with 1 argument");
    }
    if (typeof psgName !== "string") {
      throw new Error("@include: first arg (passage name) must be a string");
    }
    if (typeof elementName !== "undefined" && typeof elementName !== "string") {
      throw new Error("@include: second arg (element type) must be a string or undefined");
    }

    const actualEltName = elementName || "div";

    const passage = getPassage(psgName);
    if (!passage) {
      throw new Error(`Passage not found: "${psgName}"`);
    }
    const div = makeElement(actualEltName);
    this.render(div, passage);

    return div;
  },
});

add("", {
  handler(..._args) {
    // Pass: the args have already been evaluated by the renderer
    return document.createDocumentFragment();
  },
});

add("link", {
  handler(...args) {
    if (args.length !== 2) {
      throw new Error("@link: requires 2 arguments");
    }

    const [linkText, onClick] = args;
    if (typeof linkText !== "string") {
      throw new Error("@link: first arg (label) was not a string");
    }
    if (typeof onClick !== "function") {
      throw new Error("@link: second arg (handler) was not a function");
    }

    const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);
    button.addEventListener(
      "click",
      this.createCallback((event) => onClick.call(this, event)),
    );

    return button;
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

    // const className = getPassage(psgName) ? "btn-outline-primary" : "btn-outline-danger";
    const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);
    button.addEventListener("click", () => navigate(psgName));

    return button;
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

    const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);

    button.addEventListener("click", () => {
      const span = makeElement("span", { class: "brick-linkReplace brick-transparent" });
      if (this.content) {
        this.render(span);
      }
      button.replaceWith(span);
      setTimeout(() => span.classList.remove("brick-transparent"), 40);
    });

    return button;
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
    this.loopStatus = LoopStatus.IN_LOOP;
    while (evalExpression(conditionStr)) {
      this.render(frag, content);
      // HACK - loosen the type of `this.loopStatus` so tsc doesn't complain
      this.loopStatus = this.loopStatus as LoopStatus;
      if (this.loopStatus === LoopStatus.BREAKING) {
        this.loopStatus = LoopStatus.IN_LOOP;
        break;
      } else if (this.loopStatus === LoopStatus.CONTINUING) {
        this.loopStatus = LoopStatus.IN_LOOP;
        continue;
      }
    }

    return frag;
  },
});

add("break", {
  handler() {
    this.loopStatus = LoopStatus.BREAKING;
    return document.createDocumentFragment();
  },
});

add("continue", {
  handler() {
    this.loopStatus = LoopStatus.CONTINUING;
    return document.createDocumentFragment();
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
    if (!varStr.startsWith("_")) {
      throw new Error("@for: loop variable must be a temp variable");
    }
    const varName = varStr.substring(1);
    const place = `Brick.temp.${varName}`;
    const iterable = evalExpression(iterableStr) as Iterable<unknown>;
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new Error("@for: Right-hand side must be an iterable value, such as an array");
    }

    const frag = document.createDocumentFragment();
    const { content } = this;
    this.loopStatus = LoopStatus.IN_LOOP;
    const actualCaptures = this.captures || [];
    for (const loopVal of iterable) {
      evalAssign(place, loopVal);
      this.captures = [...actualCaptures, { name: varName, value: loopVal }];
      this.render(frag, content);
      // HACK - loosen the type of `this.loopStatus` so tsc doesn't complain
      this.loopStatus = this.loopStatus as LoopStatus;
      if (this.loopStatus === LoopStatus.BREAKING) {
        this.loopStatus = LoopStatus.IN_LOOP;
        break;
      } else if (this.loopStatus === LoopStatus.CONTINUING) {
        this.loopStatus = LoopStatus.IN_LOOP;
      }
    }
    this.captures = actualCaptures;

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

    const input = makeElement("input", {
      type: "checkbox",
      id: uniqueId(),
      class: "form-check-input",
    });
    input.checked = !!initValue;
    input.addEventListener("change", () => evalAssign(place, input.checked));

    const labelElt = makeElement(
      "label",
      { class: "form-check-label", for: input.id },
      " ",
      labelText,
    );

    const div = makeElement("div", { class: "form-check" }, input, labelElt);

    return div;
  },
});

add("switch", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error("@switch: requires 1 arg");
    }
    if (!this.content) {
      throw new Error("@switch: requires a body");
    }

    const [value] = args;

    const children: MacroTemplate[] = [];
    for (const node of this.content) {
      if (typeof node === "string") {
        if (node.trim()) {
          throw new Error("@switch: all children must be @case macros");
        }
        // pass: skip over text nodes that are all whitespace
      } else if (node instanceof MacroTemplate) {
        children.push(node);
      } else {
        throw new Error("@switch: all children must be @case macros");
      }
    }

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.name === "default") {
        if (i !== children.length - 1) {
          throw new Error("@switch: @default must be the last macro");
        }
        if (child.args.length > 0) {
          throw new Error("@switch: @default cannot receive any arguments");
        }
      } else if (child.name !== "case") {
        throw new Error("@switch: all children must be @case macros");
      } else if (child.args.length === 0) {
        throw new Error("@switch: @case macro requires at least one argument");
      }
    }

    const output = document.createDocumentFragment();
    for (const child of children) {
      if (child.name === "default") {
        this.render(output, child.content);
        return output;
      }
      for (const arg of child.args) {
        const other = evalExpression(arg);
        if (value === other) {
          this.render(output, child.content);
          return output;
        }
      }
    }

    return output;
  },
});

add("if", {
  trailingMacros: ["elseif", "else"],
  handler() {
    if (!this.content) {
      throw new Error("@if: no child templates");
    }

    for (const template of this.content) {
      if (!(template instanceof MacroTemplate)) {
        throw new Error("@if: child was not a MacroTemplate");
      }
      if (template.name === "else" || evalExpression(template.args.join(","))) {
        const output = document.createDocumentFragment();
        this.render(output, template.content);
        return output;
      }
    }

    // no conditions matched
    return document.createDocumentFragment();
  },
});

add("do", {
  handler() {
    const { content } = this;
    if (!content) {
      throw new Error("@do: must be called with a body");
    }
    const span = makeElement("span", { class: "brick-macro-do" });
    // Catch a bad break/continue on first render
    this.loopStatus = LoopStatus.OUTSIDE_LOOP;
    try {
      this.render(span);
    } catch (error) {
      if (error instanceof Error) {
        const re = /^Can't (@break|@continue) from outside a loop$/;
        const match = re.exec(error.message);
        if (match) {
          error.message = `Can't ${match[1]} from within a @do macro`;
        }
      }
      throw error;
    }
    span.addEventListener("brick-redo", () => {
      span.innerHTML = "";
      this.render(span);
    });

    return span;
  },
});
