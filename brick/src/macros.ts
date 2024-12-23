/**
 * @module macros
 *
 * This module defines the function `macros.add` which lets authors define new macros.
 * It also includes all of the built-in macros in Brick.
 */

import config from "./config";
import * as engine from "./engine";
import { MacroError } from "./error";
import { MacroChainSegment, NodeTemplate, Parser, PostscriptCall } from "./parser";
import { render, renderPassage } from "./renderer";
import { evalAssign, evalExpression, evalJavaScript } from "./scripting";
import { makeElement, stringify, uniqueId } from "./util";

export const BRICK_MACRO_SYMBOL = Symbol.for("BRICK_MACRO");

export interface Macro {
  (context: MacroContext, ...args: unknown[]): string | Node;
  [BRICK_MACRO_SYMBOL]: true | { chainWith?: RegExp; isForMacro?: boolean; skipArgs?: boolean };
}

export function isMacro(maybeMacro: unknown): maybeMacro is Macro {
  if (typeof maybeMacro === "function" && BRICK_MACRO_SYMBOL in maybeMacro) {
    const opts = maybeMacro[BRICK_MACRO_SYMBOL];
    if (typeof opts === "object" || opts === true) {
      return true;
    }
  }
  return false;
}

interface CapturedVar {
  name: string;
  value: unknown;
}

export class BreakSignal {
  context: MacroContext;
  type: "break" | "continue";

  constructor(context: MacroContext, type: "break" | "continue") {
    this.context = context;
    this.type = type;
  }

  toString() {
    return `Signal from @${this.type} in "${this.context.passageName}" line ${this.context.lineNumber}`;
  }
}

export function createMacro(
  macroFunc: (context: MacroContext, ...args: unknown[]) => string | Node,
  options?: { chainWith?: RegExp; isForMacro?: boolean; skipArgs?: boolean },
): Macro {
  const m: Macro = (ctx, ...args) => macroFunc(ctx, ...args);
  m[BRICK_MACRO_SYMBOL] = options ?? true;
  return m;
}

export function installBuiltins(constants: Record<string, unknown>) {
  Object.assign(constants, {
    "": unnamed,
    "-": print,
    "=": renderMacro,
    append: makeReplaceMacro("append"),
    break: breakMacro,
    checkBox,
    continue: continueMacro,
    for: forMacro,
    if: ifMacro,
    include,
    later,
    link,
    linkReplace,
    prepend: makeReplaceMacro("prepend"),
    print,
    punt,
    redoable,
    render: renderMacro,
    replace: makeReplaceMacro("replace"),
    switch: switchMacro,
    textBox,
    while: whileMacro,
  });
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
          oldVals[capture.name] = engine.tempVariables[capture.name];
        }
        engine.tempVariables[capture.name] = capture.value;
      }

      let returnValue: unknown;
      try {
        returnValue = func.apply(this, args);
      } finally {
        Object.assign(engine.tempVariables, oldVals);
      }

      return returnValue;
    };

    return wrapped as unknown as F;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

// const macros = new Map<string, MacroOpts>();

/** Add a new macro */
// export function add(name: string, macro: MacroOpts) {
//   if (macros.has(name)) {
//     console.warn(`Replacing an existing macro: "${name}"`);
//   }
//   macros.set(name, macro);
// }

/** Add a new macro, identical to another.
 * If the older macro is later removed, the newer macro will be unaffected. */
// export function alias(oldName: string, newName: string) {
//   const m = macros.get(oldName);
//   if (!m) {
//     throw new Error(`No macro "${oldName}" found`);
//   }
//   macros.set(newName, m);
// }

// /** Get a macro definition */
// export function get(name: string): MacroOpts | null {
//   return macros.get(name) || null;
// }

// /** Remove a macro definition */
// export function remove(name: string): boolean {
//   return macros.delete(name);
// }

const include: Macro = (_context, ...args) => {
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
};
include[BRICK_MACRO_SYMBOL] = true;

const unnamed: Macro = (_ctx, ...args) => {
  evalJavaScript(args.join(", "));
  return document.createDocumentFragment();
};
unnamed[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const print: Macro = (context, ...args) => {
  if (args.length !== 1) {
    throw new Error(`requires 1 argument (got ${args.length})`);
  }
  if (context.content) {
    throw new Error(`no body allowed`);
  }

  return stringify(args[0]);
};
print[BRICK_MACRO_SYMBOL] = true;

const renderMacro: Macro = (context, ...args: unknown[]) => {
  if (args.length !== 1) {
    throw new Error(`requires 1 argument (got ${args.length})`);
  }
  if (context.content) {
    throw new Error(`no body allowed`);
  }
  if (typeof args[0] !== "string") {
    throw new Error(
      "argument must be a string. Use the String() constructor if you want to convert a value to a string.",
    );
  }
  const frag = document.createDocumentFragment();
  // TODO prevent infinite recursion
  const parser = new Parser(args[0], context.passageName, context.lineNumber);
  render(frag, parser.parse());
  return frag;
};
renderMacro[BRICK_MACRO_SYMBOL] = true;

const link: Macro = (context, ...args) => {
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
    context.createCallback(function (this: HTMLButtonElement, mouseEvent) {
      if (onClick) {
        // TODO errors thrown here will be propagated to window's error handler.
        // Would it be better to render them inline?
        onClick.call(this, mouseEvent);
      }
      if (button.dataset.linkDestination) {
        engine.navigate(button.dataset.linkDestination);
      }
    }),
  );

  return button;
};
link[BRICK_MACRO_SYMBOL] = true;
(window as unknown as Record<string, unknown>).link = link;

const linkReplace: Macro = (context, ...args) => {
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
    if (context.content) {
      render(span, context.content, context);
    }
    button.replaceWith(span);
    setTimeout(() => span.classList.remove("brick-transparent"), 40);
  });

  return button;
};
linkReplace[BRICK_MACRO_SYMBOL] = true;

const whileMacro: Macro = (context, ...args) => {
  if (args.some((x) => typeof x !== "string")) {
    throw new Error("received a non-string arg");
  }

  const conditionStr = (args as string[]).join(",");
  const frag = document.createDocumentFragment();
  const { content } = context;
  let iterations = 1;
  while (evalExpression(conditionStr)) {
    if (iterations > config.maxLoopIterations) {
      throw new Error(
        `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
      );
    }
    iterations++;
    try {
      const noErrors = content ? render(frag, content, context) : true;
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
};
whileMacro[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const breakMacro: Macro = (context) => {
  throw new BreakSignal(context, "break");
};
breakMacro[BRICK_MACRO_SYMBOL] = true;

const continueMacro: Macro = (context) => {
  throw new BreakSignal(context, "continue");
};
continueMacro[BRICK_MACRO_SYMBOL] = true;

const forMacro: Macro = (context, ...args) => {
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
  const { content } = context;
  const priorCaptures = context.captures || [];
  let iterations = 1;
  for (const loopVal of iterable) {
    if (iterations > config.maxLoopIterations) {
      throw new Error(
        `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
      );
    }
    iterations++;
    evalAssign(place, loopVal);
    context.captures = [...priorCaptures, { name: varName, value: loopVal }];
    try {
      const noErrors = content ? render(frag, content, context) : true;
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
  context.captures = priorCaptures;

  return frag;
};
forMacro[BRICK_MACRO_SYMBOL] = { isForMacro: true, skipArgs: true };

const checkBox: Macro = (_context, ...args) => {
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
};
checkBox[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const textBox: Macro = (_context, ...args) => {
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

  const initValue = stringify(evalExpression(place) || "");

  const input = makeElement("input", {
    id: uniqueId(),
    type: "text",
    value: initValue,
  });
  input.addEventListener("keyup", () => evalAssign(place, input.value));

  const labelElt = makeElement("label", { for: input.id }, labelText);

  const div = makeElement("div", {}, input, " ", labelElt);

  return div;
};
textBox[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const ifMacro: Macro = (context, ...args) => {
  const segments = args as MacroChainSegment[];
  for (const segment of segments) {
    if (!segment.name.includes("if") || evalExpression(segment.args.join(", "))) {
      const frag = document.createDocumentFragment();
      render(frag, segment.body, context);
      return frag;
    }
  }

  return "";
};
ifMacro[BRICK_MACRO_SYMBOL] = { skipArgs: true, chainWith: /else(?:\s+if)?\s*/y };

const switchMacro: Macro = (context, ...args) => {
  if (args.length !== 1) {
    throw new Error("requires 1 arg");
  }
  if (!context.content) {
    throw new Error("requires a body");
  }

  const [value] = args;

  const children = [];
  for (const node of context.content) {
    if (typeof node === "string") {
      if (node.trim()) {
        throw new Error("all children must be @case macros 1");
      }
      // pass: skip over text nodes that are all whitespace
    } else if (
      node.type === "expr" &&
      node.store === "constants" &&
      node.content &&
      ((node.base === "case" && node.ops.length === 1 && node.ops[0].type === "call") ||
        (node.base === "default" && node.ops.length === 0))
    ) {
      children.push(node);
    } else {
      throw new Error("all children must be @case macros 2");
    }
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const ops = child.ops[0] as PostscriptCall;
    if (child.base === "default") {
      if (i !== children.length - 1) {
        throw new Error("@default must be the last macro");
      }
      // if (args.length > 0) {
      //   throw new Error("@default cannot receive any arguments");
      // }
    } else if (child.base !== "case") {
      throw new Error("all children must be @case macros 3");
    } else if (ops.args.length === 0) {
      throw new Error("@case macro requires at least one argument");
    }
  }

  const output = document.createDocumentFragment();
  for (const child of children) {
    if (child.base === "default") {
      if (child.content) {
        render(output, child.content, context);
      }
      return output;
    }
    for (const arg of (child.ops[0] as PostscriptCall).args) {
      const other = evalExpression(arg);
      if (value === other) {
        if (child.content) {
          render(output, child.content, context);
        }
        return output;
      }
    }
  }

  return output;
};
switchMacro[BRICK_MACRO_SYMBOL] = true;

const redoable: Macro = (context, ..._args) => {
  const { content } = context;
  if (!content) {
    throw new Error("must be called with a body");
  }
  const span = makeElement("span", { class: "brick-macro-redoable" });
  try {
    if (context.content) {
      render(span, context.content, context);
    }
  } catch (error) {
    if (error instanceof BreakSignal) {
      // Use the BreakSignal's context instead of this redoable's context
      throw new MacroError(error.context, `Can't @${error.type} from inside @${context.name}`);
    }

    throw error;
  }
  span.addEventListener("brick-redo", () => {
    span.innerHTML = "";
    if (context.content) {
      render(span, context.content, context);
    }
  });

  return span;
};
redoable[BRICK_MACRO_SYMBOL] = true;

const later: Macro = (context, ...args) => {
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
  const { content } = context;
  if (!content) {
    throw new Error("requires a body");
  }

  const span = makeElement("span", { class: "brick-macro-later", hidden: "" });

  setTimeout(
    context.createCallback(() => {
      const frag = document.createDocumentFragment();
      render(frag, content);
      span.replaceWith(frag);
    }),
    delay,
  );

  return span;
};
later[BRICK_MACRO_SYMBOL] = true;

function makeReplaceMacro(mode: "append" | "prepend" | "replace"): Macro {
  const macro: Macro = (context, ...args) => {
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
    if (context.content) {
      render(frag, context.content, context);
    } else if (context.name !== "replace") {
      throw new Error('no content provided. Use "{}" to provide content.');
    }

    switch (mode) {
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
    }

    return "";
  };
  macro[BRICK_MACRO_SYMBOL] = true;
  return macro;
}

const punt: Macro = (context, ...args) => {
  if (context.content) {
    throw new Error("Does not take content");
  }

  if (args.length === 0) {
    throw new Error("requires at least one argument");
  }

  if (!args.every((arg) => typeof arg === "string")) {
    throw new Error("received a non-string arg");
  }

  if (!args.every((arg) => arg.startsWith("Engine.temp."))) {
    throw new Error("only temp variables can be punted");
  }

  for (const arg of args) {
    engine.punt(arg.slice(12));
  }

  return "";
};
punt[BRICK_MACRO_SYMBOL] = { skipArgs: true };
