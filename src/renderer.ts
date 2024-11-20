import Config from "./config";
import { storyVariables, tempVariables } from "./engine";
import { BrickError, DynamicAttributeError } from "./error";
import { BreakSignal, get as getMacro, MacroContext } from "./macros";
import { ElementTemplate, isMacro, NodeTemplate, Parser } from "./parser";
import { Passage, get as getPassage } from "./passages";
import { evalExpression } from "./scripting";
import { makeElement } from "./util";

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
  return makeElement("span", { class: "brick-error" }, String(error));
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

export function render(
  target: ParentNode,
  input: NodeTemplate[] | Passage,
  parentContext?: MacroContext,
): boolean {
  // TODO infinite recursion safeguard
  return renderRaw(target, input, parentContext);
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
  for (let i = 0; i < input.length; i++) {
    const nt = input[i];
    let elt: Element | string;
    if (typeof nt === "string") {
      elt = nt;
      const paragraphs = elt.split("\n\n");
      let p = paragraphs.shift();
      if (typeof p === "string") {
        target.append(p);
        while (typeof (p = paragraphs.shift()) === "string") {
          target.append(makeElement("br"));
          target.append(makeElement("br"));
          target.append(p);
        }
      }
    } else if (nt.type === "macro") {
      const macroData = getMacro(nt.name);
      if (!macroData) {
        throw new Error(`Macro not found: "${nt.name}"`);
      }

      let childContext: MacroContext;
      let params: unknown[];
      if (macroData.trailingMacros) {
        const templates = [nt];
        for (let j = i + 1; j < input.length; j++) {
          const nextNode = input[j];
          if (isMacro(nextNode) && macroData.trailingMacros.includes(nextNode.name)) {
            templates.push(nextNode);
            i = j;
          } else if (typeof nextNode === "string" && !nextNode.trim()) {
            // skip over whitespace
          } else {
            break;
          }
        }

        childContext = new MacroContext(
          nt.name,
          nt.passageName,
          nt.lineNumber,
          parentContext,
          templates,
        );
        params = [];
      } else {
        params = macroData.skipArgs ? nt.args : nt.args.map((arg) => evalExpression(arg));
        childContext = new MacroContext(
          nt.name,
          nt.passageName,
          nt.lineNumber,
          parentContext,
          nt.content,
        );
      }

      // TODO: catch errors here
      const macroOutput = macroData.handler.apply(childContext, params);
      target.append(macroOutput);
    } else if (nt.type === "element") {
      noErrors = renderElement(nt, target, parentContext) || noErrors;
    } else if (nt.type === "linkBox") {
      const macroData = getMacro("linkTo");
      if (!macroData) {
        throw new Error("Can't find @linkTo macro for wiki-style [[link]]");
      }
      if (!nt.text) {
        throw new Error("The text of a [[link box]] cannot be empty");
      }
      const childContext = new MacroContext("linkTo", nt.passageName, nt.lineNumber);
      target.append(macroData.handler.call(childContext, nt.link, nt.text));
    } else if (nt.type === "error") {
      noErrors = false;
      // const br = makeElement("br");
      // const loc = makeElement("code", {}, nt.locationSample);
      // const span = makeElement("span", { class: "brick-error" }, `ERROR: ${nt.message}`, br, loc);
      target.append(renderError(new BrickError(nt.message, nt.passageName, nt.lineNumber)));
    } else {
      const value = (nt.type === "story" ? storyVariables : tempVariables)[nt.name];
      target.append(String(value));
    }
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
      const value = String(evalExpression(script));
      element.setAttribute(key, value);
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
