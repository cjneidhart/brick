const RE = {
  closeTag: />/y,
  commentBlock: /\*(?:[^])*?\*\//y,
  commentLine: /\/.*\n?/y,
  elementName: /[a-zA-Z]+/y,
  htmlAttr: /\s*([@a-zA-Z_0-9]+)="([^"]*)"/y,
  js: {
    normalChars: /[^"'`()[\]{}/$_,]*/y,
    stringDouble: /"(?:[^\\"]|\\(?:.|\s))*"/y,
    stringSingle: /'(?:[^\\']|\\(?:.|\s))*'/y,
  },
  macroInvoke: /([A-Za-z0-9_]*)\s*\(/y,
  normalChars: /[^[\]{}\\($_?<@/]+/y,
  singleChar: /.|\s/y,
  whitespace: /\s*/y,
};

export class ElementTemplate {
  name: string;
  attributes: Map<string, string>;
  content: NodeTemplate[];

  constructor(name: string, attrs: Map<string, string>, content: NodeTemplate[]) {
    this.name = name;
    this.attributes = attrs;
    this.content = content;
  }
}

// Represents a not-yet-invoked macro
export class MacroTemplate {
  name: string;
  args: string[];
  content: NodeTemplate[];

  constructor(name: string, args: string[], content: NodeTemplate[]) {
    this.name = name;
    this.args = args;
    this.content = content;
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
    outer: while (this.index < this.input.length) {
      if (iterations >= 1_000_000) {
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
        return output;
      }

      const c = this.consume(RE.singleChar)?.[0];
      switch (c) {
        case "\\": {
          const c2 = this.lookahead();
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
          output.push(this.parseMacro());
          break;

        case "/":
          switch (this.lookahead()) {
            case "/":
              this.consume(RE.commentLine);
              break;
            case "*":
              if (!this.consume(RE.commentBlock)) {
                throw new Error("Unclosed block comment");
              }
              break;
            default:
              output.push(c);
              // leave the second character for now
              break;
          }
          break;

        case "(":
        case "$":
        case "_":
        case "?":
        case "[":
        case "]":
          throw new Error(`Cannot yet handle unescaped '${c}' (U+${c.charCodeAt(0)})`);

        case undefined:
          // end of input
          break outer;

        default:
          throw new Error("Logic error");
      }
    }

    if (closer && !this.consume(closer)) {
      throw new Error(`Failed to match regex "${closer.source}"`);
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

  parseMacro(): MacroTemplate {
    const match = this.consume(RE.macroInvoke);
    if (!match) {
      throw new Error("Unescaped '@'");
    }
    const macroName = match[1];

    const args = this.parseJsArgs();

    const hasContent = this.consume(/\s*\{/y);
    const content = hasContent ? this.parse(/\}/y) : [];

    return new MacroTemplate(macroName, args, content);
  }

  parseJsArgs(): string[] {
    const args = [];
    let arg;
    while ((arg = this.parseJsExpression())) {
      args.push(arg);
      if (!this.consume(/\s*,/uy)) {
        break;
      }
    }

    if (!this.consume(/\s*\)/uy)) {
      throw new Error("No closing paren");
    }

    return args;
  }

  parseJsExpression(): string {
    const startIdx = this.index;
    const nesting = [];
    outer: while (this.index < this.input.length) {
      this.consume(RE.js.normalChars);

      const c = this.lookahead();
      switch (c) {
        case '"':
          if (!this.consume(RE.js.stringDouble)) {
            throw new Error("Unclosed double-quoted string");
          }
          break;

        case "'":
          if (!this.consume(RE.js.stringSingle)) {
            throw new Error("Unclosed single-quoted string");
          }
          break;

        case "(":
          nesting.push(")");
          this.index++;
          break;

        case "[":
          nesting.push("]");
          this.index++;
          break;

        case "{":
          nesting.push("}");
          this.index++;
          break;

        case ",":
          if (nesting.length > 0) {
            // in a sub-expression, just continue
            this.index++;
          } else {
            // at outer level, end the expression
            break outer;
          }
          break;

        default:
          if (c && c === nesting[nesting.length - 1]) {
            this.index++;
            break;
          }

          if (![")", "]", "}"].includes(c || "")) {
            throw new Error(`Can't handle unescaped ${c} yet`);
          }
          break outer;
      }
    }

    if (nesting.length > 0) {
      throw new Error(`Expected a "${nesting.pop()}"`);
    }

    return this.input.substring(startIdx, this.index);
  }
}
