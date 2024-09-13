import { storyVariables, tempVariables } from "./engine";
import { get as getMacro, LoopStatus, MacroContext } from "./macros";
import { ElementTemplate, MacroTemplate, NodeTemplate, Parser } from "./parser";
import { evalExpression } from "./scripting";
import { makeElement } from "./util";

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

/**
 * Render the given brick markup and append it to an element.
 */
export function render(
  target: Element | DocumentFragment,
  input: string | NodeTemplate[],
  parentContext?: MacroContext,
) {
  let inputNodes;
  if (typeof input === "string") {
    const parser = new Parser(input);
    inputNodes = parser.parse();
  } else {
    inputNodes = input;
  }

  // let pBuffer: (string | Element)[] = [];
  for (let i = 0; i < inputNodes.length; i++) {
    const nt = inputNodes[i];
    let elt: Element | string;
    if (nt instanceof MacroTemplate) {
      const macroData = getMacro(nt.name);
      if (!macroData) {
        throw new Error(`Macro not found: "${nt.name}"`);
      }

      let childLoopStatus = parentContext?.loopStatus || LoopStatus.OUTSIDE_LOOP;
      let childContext: MacroContext;
      let params: unknown[];
      if (macroData.trailingMacros) {
        const templates = [nt];
        for (let j = i + 1; j < inputNodes.length; j++) {
          const nextNode = inputNodes[j];
          if (
            nextNode instanceof MacroTemplate &&
            macroData.trailingMacros.includes(nextNode.name)
          ) {
            templates.push(nextNode);
            i = j;
          } else if (typeof nextNode === "string" && !nextNode.trim()) {
            // skip over whitespace
          } else {
            break;
          }
        }

        childContext = new MacroContext(nt.name, childLoopStatus, templates);
        params = [];
      } else {
        params = macroData.skipArgs ? nt.args : nt.args.map((arg) => evalExpression(arg));
        childContext = new MacroContext(nt.name, childLoopStatus, nt.content);
      }

      const node = macroData.handler.apply(childContext, params);
      target.append(node);

      childLoopStatus = childContext.loopStatus;
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
    } else if (nt instanceof ElementTemplate) {
      // Note: This could be a parse-time error, but renderer errors can be presented better.
      if (BANNED_TAGS.includes(nt.name)) {
        throw new Error(`<${nt.name}> elements cannot be created from markup`);
      }
      elt = makeElement(nt.name);
      for (const [attrKey, attrVal] of nt.attributes) {
        if (attrKey.startsWith("@")) {
          throw new Error('Unsupported: attribute names starting with "@"');
        }
        elt.setAttribute(attrKey, attrVal);
      }
      render(elt, nt.content, parentContext);
      target.append(elt);
    } else if (typeof nt === "string") {
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
    } else if (nt.type === "linkBox") {
      const macroData = getMacro("linkTo");
      if (!macroData) {
        throw new Error("Can't find @linkTo macro for wiki-style [[link]]");
      }
      const childContext = new MacroContext("linkTo", LoopStatus.OUTSIDE_LOOP);
      target.append(macroData.handler.call(childContext, nt.link, nt.text ?? nt.link));
    } else {
      const value = (nt.type === "story" ? storyVariables : tempVariables)[nt.name];
      target.append(String(value));
    }

    // if (isPhrasingNode(elt)) {
    //   if (typeof elt === "string") {
    //     const paragraphs = elt.split("\n\n");
    //     if (paragraphs.length > 1) {
    //       // first p
    //       const p = document.createElement("p");
    //       p.append(...pBuffer);
    //       pBuffer.length = 0;
    //       p.append(paragraphs[0]);
    //       output.append(p);

    //       // middle ps
    //       for (let i = 1; i < paragraphs.length - 1; i++) {
    //         const p = document.createElement("p");
    //         p.textContent = paragraphs[i];
    //         output.append(p);
    //       }

    //       // last p - back on the stack
    //       pBuffer.push(paragraphs[paragraphs.length - 1]);
    //     } else {
    //       // elt is a string without any double-linebreaks
    //       pBuffer.push(elt);
    //     }
    //   } else {
    //     // elt is an Element that falls under 'phrasing content'
    //     pBuffer.push(elt);
    //   }
    // } else {
    //   // elt is an Element that does not fall under 'phrasing content'
    //   output.append(elt);
    // }
  }

  // if (pBuffer.length > 0) {
  //   const p = document.createElement("p");
  //   p.append(...pBuffer);
  //   target.append(p);
  // }
}
