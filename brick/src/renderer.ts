import Config from "./config";
import { constants, storyVariables, tempVariables } from "./engine";
import { BrickError, DynamicAttributeError, ExprError, MacroError } from "./error";
import { BreakSignal, BRICK_MACRO_SYMBOL, isMacro, Macro, MacroContext } from "./macros";
import { ElementTemplate, Expr, NodeTemplate, Parser, PostscriptCall } from "./parser";
import { Passage, get as getPassage } from "./passages";
import { evalExpression } from "./scripting";
import { makeElement, stringify } from "./util";

const PHRASING_TAGS = [
  "abbr",
  "audio",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "canvas",
  "cite",
  "code",
  "data",
  "datalist",
  "dfn",
  "em",
  "embed",
  "i",
  "iframe",
  "img",
  "input",
  "kbd",
  "label",
  "mark",
  "math",
  "meter",
  "noscript",
  "object",
  "output",
  "picture",
  "progress",
  "q",
  "ruby",
  "s",
  "samp",
  "script",
  "select",
  "slot",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "template",
  "textarea",
  "time",
  "u",
  "var",
  "video",
  "wbr",
];

const SOMETIMES_PHRASING_TAGS = ["a", "del", "ins", "map"];

function _isPhrasingNode(node: string | Element): boolean {
  // TODO:
  // <link> and <meta> if the `itemprop` attribute is present
  // <area> if it is a descendant of a <map> element
  if (typeof node === "string" || PHRASING_TAGS.includes(node.tagName.toLowerCase())) {
    return true;
  } else if (SOMETIMES_PHRASING_TAGS.includes(node.tagName.toLowerCase())) {
    return Array.from(node.childNodes).every(
      (n) =>
        n.nodeType === Node.TEXT_NODE ||
        (n.nodeType === Node.ELEMENT_NODE && _isPhrasingNode(n as Element)),
    );
  } else {
    return false;
  }
}

/** Return a `<span>` describing the error, and log the error to the console */
function renderError(error: BrickError): HTMLSpanElement {
  console.error(error);
  return makeElement("span", { class: "brick-error" }, stringify(error));
}

export function renderPassage(target: HTMLElement, passage: string | Passage): boolean {
  if (typeof passage === "string") {
    const psg = getPassage(passage);
    if (psg) {
      return renderPassage(target, psg);
    } else {
      target.innerHTML = "";
      target.append(
        makeElement("span", { class: "brick-error" }, `No passage named "${passage}" found`),
      );
      return false;
    }
  }

  target.innerHTML = "";
  target.classList.add(`psg-${passage.slug}`);
  target.dataset.name = passage.name;
  target.dataset.tags = passage.tags.join(" ");

  return render(target, passage);
}

let recursionCount = 1000;
let recursionRecoveryMode = false;

export function render(
  target: ParentNode,
  input: NodeTemplate[] | Passage,
  parentContext?: MacroContext,
): boolean {
  if (recursionRecoveryMode) {
    return false;
  }
  if (recursionCount <= 0) {
    // passage and line# probably aren't much help here, but we'll provide them anyway
    const passageName =
      parentContext?.passageName || (input instanceof Passage && input.name) || "unknown";
    const lineNumber = parentContext?.lineNumber || 0;
    const error = new BrickError("Infinite recursion detected", passageName, lineNumber);
    target.append(renderError(error));
    recursionRecoveryMode = true;
    return false;
  }
  let returnValue;
  try {
    recursionCount--;
    returnValue = renderRaw(target, input, parentContext);
  } finally {
    recursionCount++;
    if (recursionCount >= 1000) {
      recursionRecoveryMode = false;
    }
  }
  return returnValue;
}

/** Render the given Brick markup and append it to an element. */
function renderRaw(
  target: ParentNode,
  input: NodeTemplate[] | Passage,
  parentContext?: MacroContext,
): boolean {
  let noErrors = true;
  if (input instanceof Passage) {
    const text = Config.preProcessText ? Config.preProcessText(input) : input.content;
    if (typeof text !== "string") {
      throw new TypeError(`Config.preProcessText returned a ${typeof text}, expected a string`);
    }
    const parser = new Parser(text, input.name);
    return render(target, parser.parse(), parentContext);
  }

  // let pBuffer: (string | Element)[] = [];
  for (const nt of input) {
    if (typeof nt === "string") {
      const paragraphs = nt.split("\n\n");
      let p = paragraphs.shift();
      if (typeof p === "string") {
        target.append(p);
        while (typeof (p = paragraphs.shift()) === "string") {
          target.append(makeElement("br"));
          target.append(makeElement("br"));
          target.append(p);
        }
      }
    } else if (nt.type === "expr") {
      noErrors = renderExpr(target, nt, parentContext) && noErrors;
    } else if (nt.type === "chain") {
      const name = nt.segments[0].name;
      const macro = constants[name];
      if (!isMacro(macro)) {
        throw new Error("chain macro not a macro");
      }
      const context = new MacroContext(name, nt.passageName, nt.lineNumber, parentContext, []);
      renderMacro(target, macro, context, nt.segments);
    } else if (nt.type === "element") {
      noErrors = renderElement(nt, target, parentContext) && noErrors;
    } else if (nt.type === "linkBox") {
      const linkMacro = constants.link;
      if (!isMacro(linkMacro)) {
        throw "link is not link";
      }
      const context = new MacroContext("link", nt.passageName, nt.lineNumber);
      renderMacro(target, linkMacro, context, [nt.text, nt.link]);
    } else if (nt.type === "error") {
      noErrors = false;
      // const br = makeElement("br");
      // const loc = makeElement("code", {}, nt.locationSample);
      // const span = makeElement("span", { class: "brick-error" }, `ERROR: ${nt.message}`, br, loc);
      target.append(renderError(new BrickError(nt.message, nt.passageName, nt.lineNumber)));
    } else {
      throw new Error(`Unknown NodeTemplate type: ${(nt as Expr).type}`);
    }
  }

  return noErrors;
}

function renderExpr(target: ParentNode, expr: Expr, parentContext?: MacroContext): boolean {
  let noErrors = true;
  const store =
    expr.store === "constants"
      ? constants
      : expr.store === "story"
        ? storyVariables
        : tempVariables;
  const storeChar = { constants: "@", story: "$", temp: "_" }[expr.store];
  let value: unknown;
  try {
    value = store[expr.base];
  } catch (error) {
    const brickError = new ExprError(
      error,
      storeChar + expr.base,
      expr.passageName,
      expr.lineNumber,
    );
    target.append(renderError(brickError));
    return false;
  }

  let previousValue: unknown = null;
  const lastOpAsCall: PostscriptCall | undefined =
    expr.ops[expr.ops.length - 1]?.type === "call"
      ? (expr.ops[expr.ops.length - 1] as PostscriptCall)
      : undefined;
  const simpleOps = lastOpAsCall ? expr.ops.slice(0, -1) : expr.ops;
  let valueStr = storeChar + expr.base;
  for (const op of simpleOps) {
    switch (op.type) {
      case "index": {
        let index;
        try {
          index = op.needsEval ? evalExpression(op.key) : op.key;
        } catch (error) {
          const brickError = new ExprError(
            error,
            op.raw.slice(1, -1),
            expr.passageName,
            expr.lineNumber,
          );
          target.append(renderError(brickError));
          return false;
        }
        previousValue = value;
        try {
          value = (value as Record<string, unknown>)[index as string];
        } catch (error) {
          const brickError = new ExprError(
            error,
            `${valueStr}${op.raw}`,
            expr.passageName,
            expr.lineNumber,
          );
          target.append(renderError(brickError));
          return false;
        }
        valueStr += op.raw;
        break;
      }

      case "call": {
        // const args = op.args.map(evalExpression);
        const args: unknown[] = [];
        for (const argStr of op.args) {
          try {
            args.push(evalExpression(argStr));
          } catch (error) {
            const brickError = new ExprError(error, argStr, expr.passageName, expr.lineNumber);
            target.append(renderError(brickError));
            return false;
          }
        }
        if (typeof value !== "function") {
          const error = new BrickError(
            `"${valueStr}" is not a function`,
            expr.passageName,
            expr.lineNumber,
          );
          target.append(renderError(error));
          return false;
        }
        let newValue;
        try {
          newValue = value.apply(previousValue, args);
        } catch (error) {
          const brickError = new ExprError(
            error,
            valueStr + op.raw,
            expr.passageName,
            expr.lineNumber,
          );
          target.append(renderError(brickError));
        }
        previousValue = value;
        value = newValue;
      }
    }
  }

  if (isMacro(value)) {
    const args = lastOpAsCall?.args || [];
    const context = new MacroContext(
      valueStr,
      expr.passageName,
      expr.lineNumber,
      parentContext,
      expr.content,
    );
    const opts = value[BRICK_MACRO_SYMBOL];
    const skipArgs = typeof opts === "object" && opts.skipArgs;
    noErrors =
      renderMacro(target, value, context, skipArgs ? args : args.map(evalExpression)) && noErrors;
  } else {
    if (expr.content) {
      const brickError = new BrickError(
        `${valueStr} is not a macro`,
        expr.passageName,
        expr.lineNumber,
      );
      target.append(renderError(brickError));
      return false;
    }
    if (lastOpAsCall) {
      const args = lastOpAsCall.args.map(evalExpression);
      if (typeof value !== "function") {
        const error = new BrickError(
          `"${valueStr}" is not a function`,
          expr.passageName,
          expr.lineNumber,
        );
        target.append(renderError(error));
        return false;
      }
      const newValue = value.apply(previousValue, args);
      previousValue = value;
      value = newValue;
    }
    target.append(value instanceof Node ? value : String(value));
  }

  return noErrors;
}

function renderElement(
  template: ElementTemplate,
  target: ParentNode,
  parentContext?: MacroContext,
): boolean {
  const element = makeElement(template.name);
  for (const [key, value] of template.attributes) {
    element.setAttribute(key, value);
  }
  for (const [key, script] of template.evalAttributes) {
    try {
      const value = evalExpression(script);
      if (key.startsWith("on") && key.length >= 3 && typeof value === "function") {
        // TODO warning for typos such as onClick
        element.addEventListener(key.substring(2), value as EventListener);
      } else {
        element.setAttribute(key, stringify(value));
      }
    } catch (error) {
      if (error instanceof BreakSignal) {
        throw error;
      }
      target.append(renderError(new DynamicAttributeError(error, key, template)));
      return false;
    }
  }
  const noErrors = render(element, template.content, parentContext);
  target.append(element);
  return noErrors;
}

function renderMacro(
  target: ParentNode,
  macro: Macro,
  context: MacroContext,
  args: unknown[],
): boolean {
  try {
    const macroOutput = macro.call(null, context, ...args);
    target.append(macroOutput);
    return true;
  } catch (error: unknown) {
    if (error instanceof BreakSignal) {
      throw error;
    }

    const wrapped = error instanceof MacroError ? error : new MacroError(context, error);
    target.append(renderError(wrapped));
    return false;
  }
}
