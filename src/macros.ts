import config from "./config";
import { navigate, tempVariables } from "./engine";
import { MacroError } from "./error";
import { isMacro, MacroTemplate, NodeTemplate, Parser } from "./parser";
import { render, renderPassage } from "./renderer";
import { evalAssign, evalExpression, evalJavaScript } from "./scripting";
import { makeElement, uniqueId } from "./util";

interface CapturedVar {
  name: string;
  value: unknown;
}

export class BreakSignal {
  context: MacroContext;
  type: "break" | "continue";

  constructor(context: MacroContext) {
    if (context.name !== "break" && context.name !== "continue") {
      throw new Error('BreakError requires a "break" or "continue" context');
    }

    this.context = context;
    this.type = context.name;
  }

  toString() {
    return `Signal from @${this.type} in "${this.context.passageName}" line ${this.context.lineNumber}`;
  }
}

/** Each time a macro is called, it receives a MacroContext as its `this`. */
export class MacroContext {
  /** The "body" (additional markup in "{}") this macro was invoked with,
   * or `undefined` if it was not given any. */
  content?: NodeTemplate[];
  /** The name this macro was called by */
  name: string;
  /** The nearest ancestor macro's context */
  parent?: MacroContext;
  /** Any captured variables this macro must be aware of */
  captures?: CapturedVar[];
  /** The name of the passage containing this macro */
  passageName: string;
  /** The line number on which this macro is called */
  lineNumber: number;

  constructor(
    name: string,
    passageName: string,
    lineNumber: number,
    parent?: MacroContext,
    content?: NodeTemplate[],
  ) {
    this.name = name;
    // this.loopStatus = parent?.loopStatus || LoopStatus.OUTSIDE_LOOP;
    this.content = content;
    this.passageName = passageName;
    this.lineNumber = lineNumber;
    if (parent?.captures) {
      this.captures = parent.captures;
    }
  }

  /** Create a callback that will properly respect this macro's captured variables. */
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
  handler: (this: MacroContext, ...args: unknown[]) => Node | string;
}

const macros = new Map<string, Macro>();

/** Add a new macro */
export function add(name: string, macro: Macro) {
  if (macros.has(name)) {
    console.warn(`Replacing an existing macro: "${name}"`);
  }
  macros.set(name, macro);
}

/** Add a new macro, identical to another.
 * If the older macro is later removed, the newer macro will be unaffected. */
export function alias(oldName: string, newName: string) {
  const m = macros.get(oldName);
  if (!m) {
    throw new Error(`No macro "${oldName}" found`);
  }
  macros.set(newName, m);
}

/** Get a macro definition */
export function get(name: string): Macro | null {
  return macros.get(name) || null;
}

/** Remove a macro definition */
export function remove(name: string): boolean {
  return macros.delete(name);
}

add("include", {
  handler(...args: unknown[]) {
    if (args.length < 1 || args.length > 2) {
      throw new Error("must be called with 1 argument");
    }

    const [passageName, elementName] = args;

    if (typeof passageName !== "string") {
      throw new Error("first arg (passage name) must be a string");
    }
    if (typeof elementName !== "undefined" && typeof elementName !== "string") {
      throw new Error("second arg (element type) must be a string or undefined");
    }

    const actualEltName = elementName || "div";

    const elt = makeElement(actualEltName);
    // TODO should break/continue work through include boundaries?
    renderPassage(elt, passageName);

    return elt;
  },
});

add("", {
  skipArgs: true,
  handler(...args) {
    evalJavaScript(args.join(", "));
    return document.createDocumentFragment();
  },
});

add("print", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error(`requires 1 argument (got ${args.length})`);
    }
    if (this.content) {
      throw new Error(`no body allowed`);
    }

    if (Array.isArray(args[0]) && args[0].toString === Array.prototype.toString) {
      return `[${args[0].join(", ")}]`;
    }
    return String(args[0]);
  },
});

alias("print", "-");

add("render", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error(`requires 1 argument (got ${args.length})`);
    }
    if (this.content) {
      throw new Error(`no body allowed`);
    }
    const frag = document.createDocumentFragment();
    // TODO prevent infinite recursion
    const parser = new Parser(String(args[0]), this.passageName, this.lineNumber);
    render(frag, parser.parse());
    return frag;
  },
});

alias("render", "=");

add("link", {
  handler(...args) {
    if (args.length < 1 || args.length > 3) {
      throw new Error("requires 1, 2 or 3 arguments");
    }

    if (typeof args[0] !== "string") {
      throw new Error("first argument (link text) must be a string");
    }
    const linkText = args[0];

    let psgName: string | undefined, onClick: Function | undefined;
    if (args.length === 2) {
      if (typeof args[1] === "string") {
        psgName = args[1];
        onClick = undefined;
      } else if (typeof args[1] === "function") {
        psgName = undefined;
        onClick = args[1];
      } else {
        throw new Error("second argument must be a string or function");
      }
    } else if (args.length === 3) {
      // special error for swapped argument order
      if (typeof args[1] === "function" && typeof args[2] === "string") {
        throw new Error("second argument must be a string and third argument must be a function");
      }
      if (typeof args[1] !== "string") {
        throw new Error("second argument must be a string");
      }
      if (typeof args[2] !== "function") {
        throw new Error("third argument must be a function");
      }
      psgName = args[1];
      onClick = args[2];
    } else {
      console.warn(`@link received only 1 argument. This link will do nothing when clicked.`);
      psgName = undefined;
      onClick = undefined;
    }

    const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);
    if (psgName) {
      button.dataset.linkDestination = psgName;
    }
    button.addEventListener(
      "click",
      this.createCallback(function (this: HTMLButtonElement, mouseEvent) {
        if (onClick) {
          // TODO errors thrown here will be propagated to window's error handler.
          // Would it be better to render them inline?
          onClick.call(this, mouseEvent);
        }
        if (button.dataset.linkDestination) {
          navigate(button.dataset.linkDestination);
        }
      }),
    );

    return button;
  },
});

add("linkReplace", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error("requires exactly 1 argument");
    }
    const [linkText] = args;
    if (typeof linkText !== "string") {
      throw new Error("first arg (link text) must be a string");
    }

    const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);

    button.addEventListener("click", () => {
      const span = makeElement("span", { class: "brick-linkReplace brick-transparent" });
      if (this.content) {
        render(span, this.content, this);
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
      throw new Error("received a non-string arg");
    }

    const conditionStr = (args as string[]).join(",");
    const frag = document.createDocumentFragment();
    const { content } = this;
    let iterations = 1;
    while (evalExpression(conditionStr)) {
      if (iterations > config.maxLoopIterations) {
        throw new Error(
          `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
        );
      }
      iterations++;
      try {
        const noErrors = content ? render(frag, content, this) : true;
        if (!noErrors) {
          break;
        }
      } catch (error) {
        if (error instanceof BreakSignal) {
          if (error.type === "break") {
            break;
          } else {
            continue;
          }
        } else {
          throw error;
        }
      }
    }

    return frag;
  },
});

add("break", {
  handler() {
    throw new BreakSignal(this);
  },
});

add("continue", {
  handler() {
    throw new BreakSignal(this);
  },
});

add("for", {
  skipArgs: true,
  handler(...args) {
    if (!args.every((x) => typeof x === "string")) {
      throw new Error("received a non-string arg");
    }
    if (args.length !== 2) {
      throw new Error("requires exactly 2 arguments");
    }

    const [varStr, iterableStr] = args;
    if (!varStr.startsWith("_")) {
      throw new Error("loop variable must be a temp variable");
    }
    const varName = varStr.substring(1);
    const place = `Engine.temp.${varName}`;
    const iterable = evalExpression(iterableStr) as Iterable<unknown>;
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new Error("Right-hand side must be an iterable value, such as an array");
    }

    const frag = document.createDocumentFragment();
    const { content } = this;
    const priorCaptures = this.captures || [];
    let iterations = 1;
    for (const loopVal of iterable) {
      if (iterations > config.maxLoopIterations) {
        throw new Error(
          `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
        );
      }
      iterations++;
      evalAssign(place, loopVal);
      this.captures = [...priorCaptures, { name: varName, value: loopVal }];
      try {
        const noErrors = content ? render(frag, content, this) : true;
        if (!noErrors) {
          break;
        }
      } catch (error) {
        if (error instanceof BreakSignal) {
          if (error.type === "break") {
            break;
          } else {
            continue;
          }
        } else {
          throw error;
        }
      }
    }
    this.captures = priorCaptures;

    return frag;
  },
});

add("checkBox", {
  skipArgs: true,
  handler(...args) {
    if (args.length !== 2) {
      throw new Error("requires 2 arguments");
    }
    if (args.some((arg) => typeof arg !== "string")) {
      throw new Error("both arguments must be strings");
    }

    const [place, labelExpr] = args as string[];
    const labelText = evalExpression(labelExpr);
    if (typeof labelText !== "string" && !(labelText instanceof Node)) {
      throw new Error("label must be a string or Node");
    }

    const initValue = evalExpression(place);

    const input = makeElement("input", {
      type: "checkbox",
      id: uniqueId(),
    });
    input.checked = !!initValue;
    input.addEventListener("change", () => evalAssign(place, input.checked));

    const labelElt = makeElement("label", { for: input.id }, labelText);

    const div = makeElement("div", {}, input, " ", labelElt);

    return div;
  },
});

add("textBox", {
  skipArgs: true,
  handler(...args) {
    if (args.length !== 2) {
      throw new Error("requires 2 arguments");
    }
    if (!args.every((arg) => typeof arg === "string")) {
      throw new Error("both arguments must be strings");
    }

    const [place, labelExpr] = args;
    const labelText = evalExpression(labelExpr);
    if (typeof labelText !== "string" && !(labelText instanceof Node)) {
      throw new Error("label must be a string or Node");
    }

    const initValue = String(evalExpression(place) || "");

    const input = makeElement("input", {
      id: uniqueId(),
      type: "text",
      value: initValue,
    });
    input.addEventListener("keyup", () => evalAssign(place, input.value));

    const labelElt = makeElement("label", { for: input.id }, labelText);

    const div = makeElement("div", {}, input, " ", labelElt);

    return div;
  },
});

add("switch", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error("requires 1 arg");
    }
    if (!this.content) {
      throw new Error("requires a body");
    }

    const [value] = args;

    const children: MacroTemplate[] = [];
    for (const node of this.content) {
      if (typeof node === "string") {
        if (node.trim()) {
          throw new Error("all children must be @case macros");
        }
        // pass: skip over text nodes that are all whitespace
      } else if (node.type === "macro") {
        children.push(node);
      } else {
        throw new Error("all children must be @case macros");
      }
    }

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.name === "default") {
        if (i !== children.length - 1) {
          throw new Error("@default must be the last macro");
        }
        if (child.args.length > 0) {
          throw new Error("@default cannot receive any arguments");
        }
      } else if (child.name !== "case") {
        throw new Error("all children must be @case macros");
      } else if (child.args.length === 0) {
        throw new Error("@case macro requires at least one argument");
      }
    }

    const output = document.createDocumentFragment();
    for (const child of children) {
      if (child.name === "default") {
        if (child.content) {
          render(output, child.content, this);
        }
        return output;
      }
      for (const arg of child.args) {
        const other = evalExpression(arg);
        if (value === other) {
          if (child.content) {
            render(output, child.content, this);
          }
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
      throw new Error("no child templates");
    }

    for (const template of this.content) {
      if (!isMacro(template)) {
        throw new Error("child was not a MacroTemplate");
      }
      if (template.name === "else" || evalExpression(template.args.join(","))) {
        const output = document.createDocumentFragment();
        if (template.content) {
          render(output, template.content, this);
        }
        return output;
      }
    }

    // no conditions matched
    return document.createDocumentFragment();
  },
});

add("redoable", {
  handler() {
    const { content } = this;
    if (!content) {
      throw new Error("must be called with a body");
    }
    const span = makeElement("span", { class: "brick-macro-redoable" });
    try {
      if (this.content) {
        render(span, this.content, this);
      }
    } catch (error) {
      if (error instanceof BreakSignal) {
        // Use the BreakSignal's context instead of this redoable's context
        throw new MacroError(error.context, `Can't @${error.type} from inside @${this.name}`);
      }

      throw error;
    }
    span.addEventListener("brick-redo", () => {
      span.innerHTML = "";
      if (this.content) {
        render(span, this.content, this);
      }
    });

    return span;
  },
});

add("later", {
  handler(...args) {
    // TODO allow delay to be a string, e.g "2s" or "300ms"
    // TODO add option to specify container element type
    if (args.length !== 0 && args.length !== 1) {
      throw new Error("does not take any args");
    }
    let delay = 40;
    if (args.length === 1) {
      if (typeof args[0] !== "number") {
        throw new Error("first argument must be a number");
      }
      delay = args[0];
    }
    const { content } = this;
    if (!content) {
      throw new Error("requires a body");
    }

    const span = makeElement("span", { class: "brick-macro-later", hidden: "" });

    setTimeout(
      this.createCallback(() => {
        const frag = document.createDocumentFragment();
        render(frag, content);
        span.replaceWith(frag);
      }),
      delay,
    );

    return span;
  },
});

add("replace", {
  handler(...args) {
    if (args.length !== 1) {
      throw new Error("requires exactly one argument");
    }
    if (typeof args[0] !== "string") {
      throw new Error("first argument must be a string");
    }

    const target = document.querySelector(args[0]);
    if (!target) {
      throw new Error(`The selector '${args[0]}' did not match any elements`);
    }

    const frag = document.createDocumentFragment();
    if (this.content) {
      render(frag, this.content, this);
    } else if (this.name !== "replace") {
      throw new Error('no content provided. Use "{}" to provide content.');
    }

    switch (this.name) {
      case "append":
        target.append(frag);
        break;
      case "prepend":
        target.prepend(frag);
        break;
      case "replace":
        target.innerHTML = "";
        target.append(frag);
        break;
      default:
        throw new Error("Unknown name. Call this macro only with @append, @prepend, or @replace");
    }

    return "";
  },
});

alias("replace", "append");
alias("replace", "prepend");
