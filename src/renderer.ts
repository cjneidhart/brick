import { storyVariables, tempVariables } from "./engine";
import { get as getMacro } from "./macros";
import { ElementTemplate, MacroTemplate, NodeTemplate, Parser } from "./parser";
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

function isPhrasingNode(node: string | Element): boolean {
  // TODO:
  // <link> and <meta> if the `itemprop` attribute is present
  // <area> if it is a descendant of a <map> element
  if (typeof node === "string" || PHRASING_TAGS.includes(node.tagName.toLowerCase())) {
    return true;
  } else if (SOMETIMES_PHRASING_TAGS.includes(node.tagName.toLowerCase())) {
    return Array.from(node.childNodes).every(
      (n) =>
        n.nodeType === Node.TEXT_NODE ||
        (n.nodeType === Node.ELEMENT_NODE && isPhrasingNode(n as Element)),
    );
  } else {
    return false;
  }
}

/**
 * Render the given brick markup and append it to an element.
 */
export function render(output: Element | DocumentFragment, input: string | NodeTemplate[]) {
  let inputNodes;
  if (typeof input === "string") {
    const parser = new Parser(input);
    inputNodes = parser.parse();
  } else {
    inputNodes = input;
  }

  let pBuffer: (string | Element)[] = [];
  for (let i = 0; i < inputNodes.length; i++) {
    const nt = inputNodes[i];
    let elt: Element | string;
    if (nt instanceof MacroTemplate) {
      const macroData = getMacro(nt.name);
      if (!macroData) {
        throw new Error(`Macro not found: "${nt.name}"`);
      }

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

        const context = { name: nt.name, content: templates };
        const node = macroData.handler.apply(context, []);
        output.append(node);
      } else {
        const params = macroData.skipArgs ? nt.args : nt.args.map((arg) => evalExpression(arg));
        const context = { name: nt.name, content: nt.content };
        const node = macroData.handler.apply(context, params);
        output.append(node);
      }
    } else if (nt instanceof ElementTemplate) {
      elt = makeElement(nt.name);
      for (const [attrKey, attrVal] of nt.attributes) {
        if (attrKey.startsWith("@")) {
          throw new Error('Unsupported: attribute names starting with "@"');
        }
        elt.setAttribute(attrKey, attrVal);
      }
      render(elt, nt.content);
      output.append(elt);
    } else if (typeof nt === "string") {
      elt = nt;
      const paragraphs = elt.split("\n\n");
      let p = paragraphs.shift();
      if (typeof p === "string") {
        output.append(p);
        while (typeof (p = paragraphs.shift()) === "string") {
          output.append(makeElement("br"));
          output.append(makeElement("br"));
          output.append(p);
        }
      }
    } else {
      const value = (nt.type === "story" ? storyVariables : tempVariables)[nt.name];
      output.append(String(value));
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

  if (pBuffer.length > 0) {
    const p = document.createElement("p");
    p.append(...pBuffer);
    output.append(p);
  }
}
