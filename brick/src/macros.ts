/**
 * @module macros
 *
 * This module defines the function `macros.add` which lets authors define new macros.
 * It also includes all of the built-in macros in Brick.
 */

import config from "./config";
import * as engine from "./engine";
import { BrickError, MacroError } from "./error";
import { MacroChainSegment, NodeTemplate, Parser, PostscriptCall } from "./parser";
import { NewlineBehavior, render, renderPassage } from "./renderer";
import { evalAssign, evalExpression, evalJavaScript } from "./scripting";
import { makeElement, stringify, uniqueId } from "./util";

export const BRICK_MACRO_SYMBOL = Symbol.for("BRICK_MACRO");

export interface Macro {
  (context: MacroContext, ...args: unknown[]): string | Node | void;
  [BRICK_MACRO_SYMBOL]: true | { chainWith?: RegExp; isForMacro?: boolean; skipArgs?: boolean };
}

export function isMacro(maybeMacro: unknown): maybeMacro is Macro {
  if (typeof maybeMacro === "function" && BRICK_MACRO_SYMBOL in maybeMacro) {
    const opts = maybeMacro[BRICK_MACRO_SYMBOL];
    if ((typeof opts === "object" && opts !== null) || opts === true) {
      return true;
    }
  }
  return false;
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

export function createGetter(name: string, func: () => unknown) {
  Object.defineProperty(engine.constants, name, {
    configurable: true,
    enumerable: true,
    get: func,
    set(value) {
      Object.defineProperty(engine.constants, name, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    },
  });
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
    macro: macroMacro,
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
  /** The name of the passage containing this macro */
  passageName: string;
  /** The line number on which this macro is called */
  lineNumber: number;
  /** The scope of temporary variables this macro was called in */
  tempVars: Record<string, unknown>;
  /** How the renderer should handle newlines */
  newlineMode: NewlineBehavior;
  /** Output from calling the macro */
  output: DocumentFragment;

  constructor(
    name: string,
    passageName: string,
    lineNumber: number,
    tempVars: Record<string, unknown>,
    newlineMode: NewlineBehavior,
    parent?: MacroContext,
    content?: NodeTemplate[],
  ) {
    this.name = name;
    this.content = content;
    this.tempVars = tempVars;
    this.passageName = passageName;
    this.lineNumber = lineNumber;
    this.parent = parent;
    this.newlineMode = newlineMode;
    this.output = document.createDocumentFragment();
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  createTempVariableScope(): Record<string, unknown> {
    const parentScope = this.tempVars;
    const childScopeUnproxied = Object.create(parentScope);
    return new Proxy(childScopeUnproxied, {
      set(target, p, newValue, receiver) {
        if (!(p in receiver) || Object.prototype.hasOwnProperty.call(receiver, p)) {
          return Reflect.set(target, p, newValue, receiver);
        }
        return Reflect.set(parentScope, p, newValue, parentScope);
      },
    });
  }

  render(target: ParentNode, input: NodeTemplate[], scope?: Record<string, unknown>) {
    return render(target, scope || this.createTempVariableScope(), input, this.newlineMode, this);
  }
}

const include: Macro = (context, ...args) => {
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
  const childScope = context.createTempVariableScope();
  renderPassage(elt, childScope, passageName);

  return elt;
};
include[BRICK_MACRO_SYMBOL] = true;

const unnamed: Macro = (context, ...args) => {
  evalJavaScript(args.join(", "), context.tempVars);
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
  context.render(frag, parser.parse());
  return frag;
};
renderMacro[BRICK_MACRO_SYMBOL] = true;

const link = createMacro((context, ...args) => {
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
    if (!context.content) {
      console.warn(`@link received only 1 argument. This link will do nothing when clicked.`);
    }
    psgName = undefined;
    onClick = undefined;
  }

  const button = makeElement("button", { class: "brick-link", type: "button" }, linkText);
  if (psgName) {
    button.dataset.linkDestination = psgName;
  }
  button.addEventListener("click", (mouseEvent) => {
    if (onClick) {
      // TODO errors thrown here will be propagated to window's error handler.
      // Would it be better to render them inline?
      onClick.call(button, mouseEvent);
    }
    if (context.content) {
      const div = makeElement("div");
      context.render(div, context.content);
      const text = div.innerHTML.trim();
      if (text) {
        console.warn(
          "An @link macro's children, when rendered, contained non-whitespace characters. " +
            "This is likely an error. Its contents:\n" +
            text,
        );
      }
    }
    if (button.dataset.linkDestination) {
      engine.navigate(button.dataset.linkDestination);
    }
  });

  return button;
});

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
      context.render(span, context.content);
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
  while (evalExpression(conditionStr, context.tempVars)) {
    if (iterations > config.maxLoopIterations) {
      throw new Error(
        `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
      );
    }
    iterations++;
    try {
      context.render(frag, content || []);
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
  const iterable = evalExpression(iterableStr, context.tempVars) as Iterable<unknown>;
  if (typeof iterable[Symbol.iterator] !== "function") {
    throw new Error("Right-hand side must be an iterable value, such as an array");
  }

  const frag = document.createDocumentFragment();
  const { content } = context;
  let iterations = 1;
  for (const loopVal of iterable) {
    if (iterations > config.maxLoopIterations) {
      throw new Error(
        `Too many iterations (Config.maxLoopIterations = ${config.maxLoopIterations})`,
      );
    }
    iterations++;
    const childScope = context.createTempVariableScope();
    childScope[varName] = loopVal;
    try {
      context.render(frag, content || [], childScope);
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
forMacro[BRICK_MACRO_SYMBOL] = { isForMacro: true, skipArgs: true };

const checkBox: Macro = (context, ...args) => {
  if (args.length !== 2) {
    throw new Error("requires 2 arguments");
  }
  if (args.some((arg) => typeof arg !== "string")) {
    throw new Error("both arguments must be strings");
  }

  const [place, labelExpr] = args as string[];
  const labelText = evalExpression(labelExpr, context.tempVars);
  if (typeof labelText !== "string" && !(labelText instanceof Node)) {
    throw new Error("label must be a string or Node");
  }

  const initValue = evalExpression(place, context.tempVars);

  const inputElement = makeElement("input", {
    type: "checkbox",
    id: uniqueId(),
  });
  inputElement.checked = !!initValue;
  inputElement.addEventListener("change", () => evalAssign(place, inputElement.checked, context.tempVars));
  context.output.append(inputElement);

  context.output.append(" ");

  const labelElement = makeElement("label", { for: inputElement.id }, labelText);
  context.output.append(labelElement);
};
checkBox[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const textBox: Macro = (context, ...args) => {
  if (args.length !== 2) {
    throw new Error("requires 2 arguments");
  }
  if (!args.every((arg) => typeof arg === "string")) {
    throw new Error("both arguments must be strings");
  }

  const [place, labelExpr] = args;
  const labelText = evalExpression(labelExpr, context.tempVars);
  if (typeof labelText !== "string" && !(labelText instanceof Node)) {
    throw new Error("label must be a string or Node");
  }

  const initValue = stringify(evalExpression(place, context.tempVars) || "");

  const input = makeElement("input", {
    id: uniqueId(),
    type: "text",
    value: initValue,
  });
  input.addEventListener("keyup", () => evalAssign(place, input.value, context.tempVars));

  const labelElt = makeElement("label", { for: input.id }, labelText);

  const div = makeElement("div", {}, input, " ", labelElt);

  return div;
};
textBox[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const ifMacro: Macro = (context, ...args) => {
  const segments = args as MacroChainSegment[];
  for (const segment of segments) {
    if (!segment.name.includes("if") || evalExpression(segment.args.join(", "), context.tempVars)) {
      const frag = document.createDocumentFragment();
      context.render(frag, segment.body);
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
        context.render(output, child.content);
      }
      return output;
    }
    for (const arg of (child.ops[0] as PostscriptCall).args) {
      const other = evalExpression(arg, context.tempVars);
      if (value === other) {
        if (child.content) {
          context.render(output, child.content);
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
      context.render(span, context.content);
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
      context.render(span, context.content);
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

  setTimeout(() => {
    const frag = document.createDocumentFragment();
    context.render(frag, content);
    span.replaceWith(frag);
  }, delay);

  return span;
};
later[BRICK_MACRO_SYMBOL] = true;

function makeReplaceMacro(mode: "append" | "prepend" | "replace"): Macro {
  return createMacro((context, ...args) => {
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
      context.render(frag, context.content);
    } else if (mode !== "replace") {
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
  });
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

  if (!args.every((arg) => arg.startsWith("brickTempVarScope."))) {
    throw new Error("only temp variables can be punted");
  }

  for (const arg of args) {
    engine.punt(arg.slice(18));
  }

  return "";
};
punt[BRICK_MACRO_SYMBOL] = { skipArgs: true };

const macroMacro: Macro = (outerContext, ...outerArgs) => {
  if (!outerArgs.every((arg) => typeof arg === "string")) {
    throw new Error("received a non-string arg");
  }
  if (outerArgs.length < 1) {
    throw new Error("macro name required");
  }
  if (!outerContext.content) {
    throw new Error("children (body) required");
  }
  const content = outerContext.content;

  const [macroName, ...prefixedParamNames] = outerArgs;
  const paramNames = prefixedParamNames.map((prefixed) => {
    const trimmed = prefixed.trim();
    const match = /^brickTempVarScope.(\p{ID_Start}\p{ID_Continue}*)$/u.exec(trimmed);
    if (!match) {
      if (!trimmed.startsWith("_")) {
        throw new Error("Parameter names must start with '_'");
      }
      throw new Error(
        `"${trimmed.replace("brickTempVarScope.", "_")}" is an invalid parameter name`,
      );
    }
    return match[1];
  });

  const newMacro = createMacro((context, ...args) => {
    if (context.content) {
      throw new Error("This macro was created with @macro and cannot receive children");
    }

    const childScope = outerContext.createTempVariableScope();
    for (const [i, paramName] of paramNames.entries()) {
      // Use defineProperty to make sure it shadows any existing variable
      Object.defineProperty(childScope, paramName, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: args[i],
      });
    }

    const frag = document.createDocumentFragment();
    context.render(frag, content, childScope);

    return frag;
  });

  evalAssign(macroName, newMacro, outerContext.tempVars);

  return "";
};
macroMacro[BRICK_MACRO_SYMBOL] = { skipArgs: true };
