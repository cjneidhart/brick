const { MAX_SAFE_INTEGER } = Number;

const RE = {
  closeTag: /\>/y,
  elementName: /[a-zA-Z]+/y,
  htmlAttr: /\s*([@a-zA-Z_0-9]+)="([^"]*)"/y,
  macroInvoke: /@([A-Za-z_][A-Za-z0-9_]*)?\(/y,
  normalChars: /[^\[\]\{\}\\($_?<]+/y,
  singleChar: /.|\s/y,
  whitespace: /\s*/y,
};

export class ElementTemplate {
  name: string;
  attributes: Map<string, string>;
  content: NodeTemplate[];

  constructor(
    name: string,
    attrs: Map<string, string>,
    content: NodeTemplate[],
  ) {
    this.name = name;
    this.attributes = attrs;
    this.content = content;
  }
}

// Represents a not-yet-invoked macro
export class MacroTemplate {
  name: string;
  args: string;
  content: NodeTemplate[];

  constructor(name: string, args: string) {
    this.name = name;
    this.args = args;
    this.content = [];
  }
}

export type NodeTemplate = ElementTemplate | MacroTemplate | string;

export class Parser {
  input: string;
  index: number;

  constructor(source: string) {
    this.input = source;
    this.index = 0;
  }

  consume(pattern: RegExp): RegExpExecArray | null {
    // if (typeof pattern === "string") {
    //   if (this.input.substring(this.index).startsWith(pattern)) {
    //     this.index += pattern.length;
    //     return [this.input.substring(this.index, pattern.length + this.index)];
    //   } else {
    //     return null;
    //   }
    // } else {
    // }
    pattern.lastIndex = this.index;
    const match = pattern.exec(this.input);
    if (match) {
      this.index = pattern.lastIndex;
    }
    return match;
  }

  lookahead(): string | null {
    return this.input[this.index] || null;
  }

  parse(closer?: RegExp): NodeTemplate[] {
    const output: NodeTemplate[] = [];

    let iterations = 0;
    outer:
    while (this.index < this.input.length) {
      if (iterations >= MAX_SAFE_INTEGER) {
        throw new Error("Parser stuck in loop");
      } else {
        iterations++;
      }
      const oldIndex = this.index;
      this.consume(RE.normalChars);
      if (this.index !== oldIndex) {
        output.push(this.input.substring(oldIndex, this.index));
      }

      if (closer && this.consume(closer)) {
        break;
      }

      const c = this.consume(RE.singleChar)?.[0];
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
          break;

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

    while (!this.consume(RE.closeTag)) {
      console.log(this.input.substring(this.index))
      const match = this.consume(RE.htmlAttr);
      if (!match) {
        throw new Error("closing '>' expected");
      }
      const [_, key, value] = match;
      if (attrs.has(key)) {
        throw new Error(`Duplicate attribute '${key}`);
      }
      attrs.set(key, value);
    }

    const content = this.parse(new RegExp(`</${name}>`, "y"));

    return new ElementTemplate(name, attrs, content);
  }
}
