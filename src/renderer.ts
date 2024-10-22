import Config from "./config";
import { storyVariables, tempVariables } from "./engine";
import { get as getMacro, LoopStatus, MacroContext } from "./macros";
import { ElementTemplate, isMacro, NodeTemplate, Parser } from "./parser";
import { Passage } from "./passages";
import { evalExpression } from "./scripting";
import { makeElement } from "./util";

/** Tags which are not allowed to be descended from `<body>` */
const BANNED_TAGS = ["base", "body", "link", "head", "html", "meta", "script", "style", "title"];

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

/** Render the given Brick markup and append it to an element. */
export function render(
  target: Element | DocumentFragment,
  input: string | NodeTemplate[] | Passage,
  parentContext?: MacroContext,
) {
  let inputNodes;
  if (typeof input === "string") {
    const parser = new Parser(input);
    inputNodes = parser.parse();
  } else if (input instanceof Passage) {
    if (Config.preProcessText) {
      const text = Config.preProcessText(input);
      if (typeof text !== "string") {
        throw new TypeError(`Config.preProcessText returned a ${typeof text}, expected a string`);
      }
      return render(target, text);
    } else {
      return render(target, input.content);
    }
  } else {
    inputNodes = input;
  }

  // let pBuffer: (string | Element)[] = [];
  for (let i = 0; i < inputNodes.length; i++) {
    const nt = inputNodes[i];
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
        for (let j = i + 1; j < inputNodes.length; j++) {
          const nextNode = inputNodes[j];
          if (isMacro(nextNode) && macroData.trailingMacros.includes(nextNode.name)) {
            templates.push(nextNode);
            i = j;
          } else if (typeof nextNode === "string" && !nextNode.trim()) {
            // skip over whitespace
          } else {
            break;
          }
        }

        childContext = new MacroContext(nt.name, parentContext, templates);
        params = [];
      } else {
        params = macroData.skipArgs ? nt.args : nt.args.map((arg) => evalExpression(arg));
        childContext = new MacroContext(nt.name, parentContext, nt.content);
      }

      const node = macroData.handler.apply(childContext, params);
      target.append(node);

      const childLoopStatus = childContext.loopStatus;
      if (childLoopStatus === LoopStatus.BREAKING || childLoopStatus === LoopStatus.CONTINUING) {
        if (!parentContext || parentContext.loopStatus === LoopStatus.OUTSIDE_LOOP) {
          const badName = childContext.loopStatus === LoopStatus.BREAKING ? "@break" : "@continue";
          throw new Error(`Can't ${badName} from outside a loop`);
        }
        parentContext.loopStatus = childContext.loopStatus;
        return;
      }

      // Markup rendered later is always considered outside a loop
      childContext.loopStatus = LoopStatus.OUTSIDE_LOOP;
    } else if (nt.type === "element") {
      target.append(renderElement(nt, parentContext));
    } else if (nt.type === "linkBox") {
      const macroData = getMacro("linkTo");
      if (!macroData) {
        throw new Error("Can't find @linkTo macro for wiki-style [[link]]");
      }
      if (!nt.text) {
        throw new Error("The text of a [[link box]] cannot be empty");
      }
      const childContext = new MacroContext("linkTo");
      target.append(macroData.handler.call(childContext, nt.link, nt.text));
    } else if (nt.type === "error") {
      const br = makeElement("br");
      const loc = makeElement("code", {}, nt.locationSample);
      const span = makeElement("span", { class: "brick-error" }, `ERROR: ${nt.message}`, br, loc);
      target.append(span);
    } else {
      const value = (nt.type === "story" ? storyVariables : tempVariables)[nt.name];
      target.append(String(value));
    }
  }
}

function renderElement(template: ElementTemplate, parentContext?: MacroContext) {
  if (BANNED_TAGS.includes(template.name)) {
    throw new Error(`<${template.name}> elements cannot be created from markup`);
  }
  const element = makeElement(template.name);
  for (const [key, value] of template.attributes) {
    element.setAttribute(key, value);
  }
  for (const [key, script] of template.evalAttributes) {
    // TODO catch errors
    const value = String(evalExpression(script));
    element.setAttribute(key, value);
  }
  render(element, template.content, parentContext);
  return element;
}
