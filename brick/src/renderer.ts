import config from "./config";
import { constants, storyVariables } from "./engine";
import { BrickError, DynamicAttributeError, ExprError, MacroError } from "./error";
import { BreakSignal, BRICK_MACRO_SYMBOL, isMacro, Macro, MacroContext } from "./macros";
import { ElementTemplate, Expr, NodeTemplate, Parser, PostscriptCall } from "./parser";
import * as passages from "./passages";
import { Passage } from "./passages";
import { evalExpression } from "./scripting";
import { countSubstrings, makeElement, numberRange, stringify } from "./util";

const PHRASING_TAGS = new Set([
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
]);
const SWITCH_TO_PHRASING_TAGS = new Set(["ol", "p", "table", "tbody", "td", "thead", "tr", "ul"]);

/** How to handle newlines */
export type NewlineBehavior = "md-block" | "md-inline" | "allBreaks" | "noBreaks";

function renderError(target: ParentNode, error: BrickError): never {
  if (!error.displayed) {
    error.displayed = true;
    console.error(error);
    const span = makeElement("span", { class: "brick-error" }, stringify(error));
    target.append(span);
  }
  throw error;
}

export function renderPassage(
  target: HTMLElement,
  scope: Record<string, unknown>,
  passage: string | Passage,
): void {
  if (typeof passage === "string") {
    let psg: Passage;
    try {
      psg = passages.getOrThrow(passage);
    } catch (error) {
      target.innerHTML = "";
      target.append(makeElement("span", { class: "brick-error" }, stringify(error)));
      throw error;
    }
    renderPassage(target, scope, psg);
  } else {
    target.innerHTML = "";
    target.classList.add(`psg-${passage.slug}`);
    target.dataset.name = passage.name;
    target.dataset.tags = passage.tags.join(" ");

    render(target, scope, passage);
  }
}

let recursionCount = 1000;
let recursionRecoveryMode = false;

export function render(
  target: ParentNode,
  scope: Record<string, unknown>,
  input: NodeTemplate[] | Passage,
  newlineMode?: NewlineBehavior,
  parentContext?: MacroContext,
): void {
  if (recursionRecoveryMode) {
    return;
  }
  if (recursionCount <= 0) {
    // passage and line# probably aren't much help here, but we'll provide them anyway
    const passageName =
      parentContext?.passageName || (input instanceof Passage && input.name) || "unknown";
    const lineNumber = parentContext?.lineNumber || 0;
    const error = new BrickError("Infinite recursion detected", passageName, lineNumber);
    recursionRecoveryMode = true;
    renderError(target, error);
  }
  try {
    recursionCount--;
    const newlines =
      newlineMode || (config.newlineMode === "markdown" ? "md-block" : config.newlineMode);
    renderRaw(target, scope, input, newlines, parentContext);
  } finally {
    recursionCount++;
    if (recursionCount >= 1000) {
      recursionRecoveryMode = false;
    }
  }
}

/** Render the given Brick markup and append it to an element. */
function renderRaw(
  target: ParentNode,
  scope: Record<string, unknown>,
  input: NodeTemplate[] | Passage,
  newlines: NewlineBehavior,
  parentContext?: MacroContext,
): void {
  if (input instanceof Passage) {
    const text = config.preProcessText ? config.preProcessText(input) : input.content;
    if (typeof text !== "string") {
      throw new TypeError(`Config.preProcessText returned a ${typeof text}, expected a string`);
    }
    const parser = new Parser(text, input.name);
    let templates: NodeTemplate[];
    try {
      templates = parser.parse();
    } catch (error) {
      if (!(error instanceof BrickError)) {
        throw error;
      }

      target.append(
        makeElement("span", { class: "brick-error" }, stringify(error)),
        makeElement("br"),
      );
      const lines = parser.input.split("\n").map((line) => makeElement("span", {}, line));
      lines[error.lineNumber - 1].classList.add("brick-error");
      const codeElt = makeElement("code");
      for (const line of lines) {
        codeElt.append(line, makeElement("br"));
      }
      target.append(makeElement("pre", {}, codeElt));
      return;
    }
    render(target, scope, templates, newlines, parentContext);
    return;
  }

  if (newlines === "md-block") {
    input = insertParagraphs(input);
  }

  // let pBuffer: (string | Element)[] = [];
  // const nodes = input.map((template) => {
  //   return renderTemplate(template, scope, newlines, errorRef, parentContext);
  // });
  for (const template of input) {
    renderTemplate(target, template, scope, newlines, parentContext);
  }
}

function insertParagraphs(templates: NodeTemplate[]): NodeTemplate[] {
  const output = [];

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    let startsParagraph = false;
    if (typeof template === "string" || template.type === "linkBox") {
      startsParagraph = true;
    } else if (template.type === "expr" || template.type === "chain") {
      const nextTemplate = templates[i + 1];
      if (
        typeof nextTemplate === "string" ||
        (typeof nextTemplate === "object" && nextTemplate.type !== "paragraph-break")
      ) {
        startsParagraph = true;
      }
    } else if (template.type === "element" && PHRASING_TAGS.has(template.name)) {
      startsParagraph = true;
    }

    if (startsParagraph) {
      let nextBreakIndex = findNextBreak(templates, i + 1);
      if (nextBreakIndex === -1) {
        nextBreakIndex = templates.length;
      }
      const paragraphTemplate: ElementTemplate = {
        type: "element",
        passageName: "",
        lineNumber: 0,
        name: "p",
        content: templates.slice(i, nextBreakIndex),
      };
      output.push(paragraphTemplate);
      i = nextBreakIndex;
    } else {
      output.push(template);
    }
  }

  return output;
}

function renderTemplate(
  target: ParentNode,
  template: NodeTemplate,
  scope: Record<string, unknown>,
  newlines: NewlineBehavior,
  parentContext?: MacroContext,
): void {
  if (typeof template === "string") {
    if (newlines === "allBreaks") {
      const lines = template.split("\n");
      const lastLine = lines.pop();
      if (typeof lastLine === "string") {
        for (const line of lines) {
          target.append(line, makeElement("br"));
        }
        target.append(lastLine);
      }
    } else {
      target.append(template);
    }
  } else if (template.type === "paragraph-break") {
    switch (newlines) {
      case "allBreaks": {
        const count = countSubstrings(template.raw, "\n");
        for (const _ of numberRange(count)) {
          target.append(makeElement("br"));
        }
        break;
      }

      case "md-block":
        break;

      case "md-inline":
        target.append(makeElement("br"), makeElement("br"));
        break;

      case "noBreaks":
        target.append(template.raw);
    }
  } else if (template.type === "chain") {
    const name = template.segments[0].name;
    const macro = constants[name];
    if (!isMacro(macro)) {
      throw new Error("chain macro not a macro");
    }
    const context = new MacroContext(
      name,
      template.passageName,
      template.lineNumber,
      scope,
      newlines,
      parentContext,
      [],
    );
    renderMacro(target, macro, context, template.segments);
  } else if (template.type === "expr") {
    const exprRendered = document.createDocumentFragment();
    try {
      renderExpr(exprRendered, scope, template, newlines, parentContext);
    } finally {
      target.append(newlines === "md-block" ? maybeWrap(exprRendered) : exprRendered);
    }
  } else if (template.type === "linkBox") {
    const linkMacro = constants.link;
    if (!isMacro(linkMacro)) {
      throw "link is not link";
    }
    const context = new MacroContext(
      "link",
      template.passageName,
      template.lineNumber,
      scope,
      newlines,
    );
    renderMacro(target, linkMacro, context, [template.text, template.link]);
  } else if (template.type === "element") {
    const childNewlines =
      SWITCH_TO_PHRASING_TAGS.has(template.name.toLowerCase()) && newlines === "md-block"
        ? "md-inline"
        : newlines;
    renderElement(target, template, scope, childNewlines, parentContext);
  } else if (template.type === "error") {
    renderError(
      target,
      new BrickError(template.message, template.passageName, template.lineNumber),
    );
  } else {
    throw new Error(`Unknown NodeTemplate type: ${(template as Expr).type}`);
  }
}

function maybeWrap(fragment: DocumentFragment): Node {
  const output = document.createDocumentFragment();
  let currentParagraph: HTMLParagraphElement | null = null;
  for (const child of Array.from(fragment.childNodes)) {
    if (
      child instanceof Text ||
      (child instanceof Element && PHRASING_TAGS.has(child.tagName.toLowerCase()))
    ) {
      currentParagraph ??= makeElement("p");
      currentParagraph.append(child);
    } else {
      if (currentParagraph) {
        output.append(currentParagraph);
        currentParagraph = null;
      }
      output.append(child);
    }
  }
  if (currentParagraph) {
    output.append(currentParagraph);
  }
  return output;
}

function renderExpr(
  target: ParentNode,
  tempVarScope: Record<string, unknown>,
  expr: Expr,
  newlines: NewlineBehavior,
  parentContext?: MacroContext,
): void {
  const store =
    expr.store === "constants" ? constants : expr.store === "story" ? storyVariables : tempVarScope;
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
    renderError(target, brickError);
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
          index = op.needsEval ? evalExpression(op.key.trim(), tempVarScope) : op.key;
        } catch (error) {
          const brickError = new ExprError(
            error,
            op.raw.slice(1, -1),
            expr.passageName,
            expr.lineNumber,
          );
          renderError(target, brickError);
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
          renderError(target, brickError);
        }
        valueStr += op.raw;
        break;
      }

      case "call": {
        // const args = op.args.map(evalExpression);
        const args: unknown[] = [];
        for (const argStr of op.args) {
          try {
            args.push(evalExpression(argStr, tempVarScope));
          } catch (error) {
            const brickError = new ExprError(error, argStr, expr.passageName, expr.lineNumber);
            renderError(target, brickError);
          }
        }
        if (typeof value !== "function") {
          const error = new BrickError(
            `"${valueStr}" is not a function`,
            expr.passageName,
            expr.lineNumber,
          );
          renderError(target, error);
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
          return renderError(target, brickError);
        }
        previousValue = value;
        value = newValue;
      }
    }
  }

  if (isMacro(value)) {
    let args: unknown[] = lastOpAsCall?.args || [];
    const context = new MacroContext(
      valueStr,
      expr.passageName,
      expr.lineNumber,
      tempVarScope,
      newlines,
      parentContext,
      expr.content,
    );
    const opts = value[BRICK_MACRO_SYMBOL];
    const skipArgs = typeof opts === "object" && opts.skipArgs;
    if (!skipArgs) {
      const argStrings = args as string[];
      args = [];
      for (const arg of argStrings) {
        try {
          args.push(evalExpression(arg, tempVarScope));
        } catch (error) {
          const brickError = new ExprError(error, arg, expr.passageName, expr.lineNumber);
          renderError(target, brickError);
        }
      }
    }
    renderMacro(target, value, context, args);
  } else {
    if (expr.content) {
      const brickError = new BrickError(
        `${valueStr} is not a macro`,
        expr.passageName,
        expr.lineNumber,
      );
      renderError(target, brickError);
    }
    if (lastOpAsCall) {
      if (typeof value !== "function") {
        const error = new BrickError(
          `"${valueStr}" is not a function`,
          expr.passageName,
          expr.lineNumber,
        );
        renderError(target, error);
      }
      const args: unknown[] = [];
      for (const arg of lastOpAsCall.args) {
        try {
          args.push(evalExpression(arg, tempVarScope));
        } catch (error) {
          const brickError = new ExprError(error, arg, expr.passageName, expr.lineNumber);
          renderError(target, brickError);
        }
      }
      const newValue = value.apply(previousValue, args);
      previousValue = value;
      value = newValue;
    }
    target.append(value instanceof Node ? value : stringify(value));
  }
}

function renderElement(
  target: ParentNode,
  template: ElementTemplate,
  scope: Record<string, unknown>,
  newlines: NewlineBehavior,
  parentContext?: MacroContext,
): void {
  const element = makeElement(template.name);
  for (const [key, value] of template.attributes ?? []) {
    element.setAttribute(key, value);
  }
  for (const [key, script] of template.evalAttributes ?? []) {
    try {
      const value = evalExpression(script, scope);
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
      const wrapped = new DynamicAttributeError(error, key, template);
      renderError(target, wrapped);
    }
  }
  try {
    render(element, scope, template.content, newlines, parentContext);
  } finally {
    target.append(element);
  }
}

function renderMacro(
  target: ParentNode,
  macro: Macro,
  context: MacroContext,
  args: unknown[],
): void {
  const { output } = context;
  let returned: unknown;
  try {
    returned = macro.call(null, context, ...args);
  } catch (error: unknown) {
    target.append(output);
    if (error instanceof BreakSignal) {
      throw error;
    }

    const wrapped = error instanceof MacroError ? error : new MacroError(context, error);
    renderError(target, wrapped);
  }

  target.append(output);
  if (typeof returned === "string" || returned instanceof Node) {
    target.append(returned);
  } else if (typeof returned !== "undefined") {
    const error = new BrickError(
      `Macros must return a string, a Node, or undefined.`,
      context.passageName,
      context.lineNumber,
    );
    renderError(target, error);
  }
}

function findNextBreak(input: NodeTemplate[], from: number): number {
  for (let i = from; i < input.length; i++) {
    const nodeTemplate = input[i];
    if (typeof nodeTemplate === "object" && nodeTemplate.type === "paragraph-break") {
      return i;
    }
  }
  return -1;
}
