const { MAX_SAFE_INTEGER } = Number;

const RE = {
  macroInvoke: /@([A-Za-z_][A-Za-z0-9_]*)?\(/y,
  normalChar: /[^\[\]\\($_?<]+/y,
  elementName: /[a-zA-Z]+/y,
  whitespace: /\s*/y,
};

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

const SOMETIMES_PHRASING_TAGS = [
  "a",
  "del",
  "ins",
  "map",
];

class ElementTemplate {
  name: string;
  attributes: Map<string, string>;
  content: NodeTemplate[];

  constructor(name: string, attrs: Map<string, string>, content: string) {
    this.name = name;
    this.attributes = new Map();
    this.content = [];
  }
}

// Represents a not-yet-invoked macro
class MacroTemplate {
  name: string;
  args: string;
  content: NodeTemplate[];

  constructor(name: string, args: string) {
    this.name = name;
    this.args = args;
    this.content = [];
  }
}

type NodeTemplate = ElementTemplate | MacroTemplate | string;

class Parser {
  input: string;
  index: number;

  constructor(source: string) {
    this.input = source;
    this.index = 0;
  }

  consume(pattern: string | RegExp): string[] | null {
    if (typeof pattern === "string") {
      if (this.input.substring(this.index).startsWith(pattern)) {
        this.index += pattern.length;
        return [this.input.substring(this.index, pattern.length + this.index)];
      } else {
        return null;
      }
    } else {
      pattern.lastIndex = this.index;
      const match = pattern.exec(this.input);
      if (match) {
        this.index = pattern.lastIndex;
      }
      return match;
    }
  }

  lookahead(): string | null {
    return this.input[this.index] || null;
  }

  parse(): NodeTemplate[] {
    const output: NodeTemplate[] = [];

    let iterations = 0;
    outer:
    while (this.index < this.input.length) {
      if (iterations >= MAX_SAFE_INTEGER) {
        break;
      } else {
        iterations++;
      }
      const oldIndex = this.index;
      this.consume(RE.normalChar);
      if (this.index !== oldIndex) {
        output.push(this.input.substring(oldIndex, this.index));
      }

      const c = this.consume(/.|\s/y)?.[0];
      switch (c) {
        case "\\": {
          const c2 = this.input[this.index];
          if (!c2) {
            throw new Error("Trailing '\\'");
          }
          output.push(c2);
          this.index++;
          break;
        }

        case "<":
          output.push(this.parseElement());

        case "@":
        // deliberate fallthrough
        case "(":
        case "$":
        case "_":
        case "?":
        case "[":
        case "]":
          throw new Error(`Cannot yet handle unescaped '${c}'`);

        case undefined:
          // end of input
          break outer;

        default:
          throw new Error("Logic error");
      }
    }

    return output;
  }

  parseElement(): ElementTemplate {
    const name = this.consume(RE.elementName)?.[0];
    if (!name) {
      throw new Error("Element names must contain only ASCII letters");
    }

    this.consume(RE.whitespace);
    const attrs = new Map<string, string>();
    if (!this.consume(/\>/y)) {
      throw new Error("attributes not supported yet");
    }
    if (!this.consume(new RegExp(`</${name}>`, 'y'))) {
      throw new Error("Element content not supported yet");
    }

    return new ElementTemplate(name, attrs, "");
  }
}

function isPhrasingNode(node: string | Element): boolean {
  // TODO:
  // <link> and <meta> if the `itemprop` attribute is present
  // <area> if it is a descendant of a <map> element
  if (
    typeof node === "string" ||
    PHRASING_TAGS.includes(node.tagName.toLowerCase())
  ) {
    return true;
  } else if (SOMETIMES_PHRASING_TAGS.includes(node.tagName.toLowerCase())) {
    return Array.from(node.childNodes).every((n) => {
      return n.nodeType === Node.TEXT_NODE ||
        n.nodeType === Node.ELEMENT_NODE && isPhrasingNode(n as Element);
    });
  } else {
    return false;
  }
}

export function render(output: Element, input: string | NodeTemplate[]) {
  let inputNodes;
  if (typeof input === "string") {
    const parser = new Parser(input);
    inputNodes = parser.parse();
  } else {
    inputNodes = input;
  }

  console.log(inputNodes);

  let pBuffer: (string | Element)[] = [];
  for (const nt of inputNodes) {
    let elt: Element | string;
    if (nt instanceof MacroTemplate) {
      throw new Error("Can't do macros yet");
    } else if (nt instanceof ElementTemplate) {
      elt = document.createElement(nt.name);
      for (const [attrKey, attrVal] of nt.attributes) {
        if (attrKey.startsWith("@")) {
          throw new Error('Unsupported: attribute names starting with "@"');
        }
        elt.setAttribute(attrKey, attrVal);
      }
      render(elt, nt.content);
    } else {
      elt = nt;
    }

    if (isPhrasingNode(elt)) {
      if (typeof elt === "string") {
        const paragraphs = elt.split("\n\n");
        if (paragraphs.length > 1) {
          // first p
          const p = document.createElement("p");
          p.append(...pBuffer);
          pBuffer.length = 0;
          p.append(paragraphs[0]);
          output.append(p);

          // middle ps
          for (let i = 1; i < paragraphs.length - 1; i++) {
            const p = document.createElement("p");
            p.textContent = paragraphs[i];
            output.append(p);
          }

          // last p - back on the stack
          pBuffer.push(paragraphs[paragraphs.length - 1]);
        } else {
          // elt is a string without any double-linebreaks
          pBuffer.push(elt);
        }
      } else {
        // elt is an Element that falls under 'phrasing content'
        pBuffer.push(elt);
      }
    } else {
      // elt is an Element that does not fall under 'phrasing content'
      output.append(elt);
    }
  }

  if (pBuffer.length > 0) {
    const p = document.createElement("p");
    p.append(...pBuffer);
    output.append(p);
  }
}

export function render_old(output: Element, source: string) {
  let idx = 0;
  while (idx < source.length) {
    RE.normalChar.lastIndex = idx;
    if (RE.normalChar.test(source)) {
      output.append(source.substring(idx, RE.normalChar.lastIndex));
      idx = RE.normalChar.lastIndex;
    }

    if (idx >= source.length) {
      break;
    }

    switch (source[idx]) {
      case "\\": {
        const c = source[idx + 1];
        if (!c) {
          throw new Error("Trailing '\\'");
        }
        output.append(c);
        idx += 2;
        break;
      }

      case "\n":
        if (source[idx + 1] === "\n") {
          idx += 2;
          output.appendChild(document.createElement("br"));
        } else {
          idx++;
        }
        break;

      // deliberate fallthrough
      case "(":
      case "$":
      case "_":
      case "?":
      case "<":
      case "[":
      case "]":
      case "@":
        throw new Error(`Cannot yet handle unescaped '${source[idx]}'`);

      default:
        throw new Error("Logic error");
    }
  }

  output.normalize();
}
