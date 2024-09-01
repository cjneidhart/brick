const RE = {
  closeTag: />/y,
  commentBlock: /\*(?:[^])*?\*\//y,
  commentLine: /\/.*\n?/y,
  elementName: /[a-zA-Z]+/y,
  htmlAttr: /\s*([@a-zA-Z_0-9]+)="([^"]*)"/y,
  js: {
    identifier: /[a-zA-Z][a-zA-Z0-9_$]*/y,
    normalChars: /[^"'`()[\]{}/$_,a-zA-Z]*/y,
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

export interface RawVariable {
  /** The name of the variable being accessed. */
  name: string;
}

export type NodeTemplate = ElementTemplate | MacroTemplate | string | RawVariable;

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

        case "$": {
          const match = this.consume(RE.js.identifier);
          if (!match) {
            throw new Error("'$' which is not part of a variable must be escaped");
          }
          output.push({ name: match[0] });
          break;
        }


        case "(":
        case "_":
        case "?":
        case "[":
        case "]":
          throw new Error(`Cannot yet handle unescaped '${c}' (U+${c.charCodeAt(0)})`);

        case undefined:
          // end of input
          break outer;

        default:
          throw new Error(`Logic Error (${c})`);
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

    const args = macroName === "for" ? this.parseForArgs() : this.parseJsArgs();

    const hasContent = this.consume(/\s*\{/y);
    const content = hasContent ? this.parse(/\}/y) : [];

    return new MacroTemplate(macroName, args, content);
  }

  parseForArgs(): string[] {
    // TODO refine this
    let match = this.consume(/([^]*?)\s+of\b/y);
    if (!match) {
      throw new Error("Could not find 'of' in @for macro");
    }

    const loopVar = match[1];
    const loopCond = this.parseJsExpression();
    if (loopCond.trim() === "") {
      throw new Error("Right-hand side of a for macro must be an Iterable");
    }

    if (!this.consume(/\s*\)/uy)) {
      throw new Error("No closing paren");
    }

    return [loopVar, loopCond];
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
    const nesting = [];
    const output: string[] = [];
    let match;
    outer: while (this.index < this.input.length) {
      match = this.consume(RE.js.normalChars);
      if (match) {
        output.push(match[0]);
      }

      const c = this.lookahead();
      match = this.consume(RE.js.identifier);
      if (match) {
        output.push(match[0]);
        continue;
      }

      switch (c) {
        case '"':
          match = this.consume(RE.js.stringDouble);
          if (match) {
            output.push(match[0]);
          } else {
            throw new Error("Unclosed double-quoted string");
          }
          break;

        case "'":
          match = this.consume(RE.js.stringSingle);
          if (match) {
            output.push(match[0]);
          } else {
            throw new Error("Unclosed single-quoted string");
          }
          break;

        case "(":
          nesting.push(")");
          output.push(c);
          this.index++;
          break;

        case "[":
          nesting.push("]");
          output.push(c);
          this.index++;
          break;

        case "{":
          nesting.push("}");
          output.push(c);
          this.index++;
          break;

        case "$":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            output.push("Brick.vars.", match[0]);
          } else {
            throw new Error("Illegal identifier");
          }
          break;

        case ",":
          if (nesting.length > 0) {
            // in a sub-expression, just continue
            this.index++;
            output.push(c);
          } else {
            // at outer level, end the expression
            break outer;
          }
          break;

        default:
          if (c && c === nesting[nesting.length - 1]) {
            this.index++;
            output.push(c);
            nesting.pop();
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

    return output.join("");
  }
}
