const RE = {
  closeTag: />/y,
  commentBlock: /\*(?:[^])*?\*\//y,
  commentLine: /\/.*\n?/y,
  elementName: /[a-zA-Z0-9]+/y,
  htmlAttr: /\s*([@a-zA-Z_0-9]+)="([^"]*)"/y,
  js: {
    identifier: /[a-zA-Z][a-zA-Z0-9_$]*/y,
    normalChars: /[^"'`()[\]{}/$_,a-zA-Z]*/y,
    stringDouble: /"(?:[^\\"]|\\(?:.|\s))*"/y,
    stringSingle: /'(?:[^\\']|\\(?:.|\s))*'/y,
  },
  macroInvoke: /[A-Za-z0-9_]*/y,
  normalChars: /[^[\]{}\\($_?<@/]+/y,
  singleChar: /.|\s/y,
  whitespace: /\s*/y,
};

const UNCLOSED_TAGS = ["area", "br", "embed", "hr", "img", "input", "link", "meta", "track", "wbr"];

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
  type: "story" | "temp";
  /** The name of the variable being accessed. */
  name: string;
}

/** A wiki-style [[Link]] */
export interface LinkBox {
  type: "linkBox";
  link: string;
  text: string;
}

/** A parse error that should be displayed */
export interface ErrorMessage {
  type: "error";
  /** A description of the error */
  message: string;
  /** A snippet of the text where the error was found. */
  locationSample: string;
}

export type NodeTemplate =
  | ElementTemplate
  | MacroTemplate
  | string
  | RawVariable
  | LinkBox
  | ErrorMessage;

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
          output.push({ type: "story", name: match[0] });
          break;
        }

        case "_": {
          const match = this.consume(RE.js.identifier);
          if (!match) {
            throw new Error("'_' which is not part of a variable must be escaped");
          }
          output.push({ name: match[0], type: "temp" });
          break;
        }

        case "[":
          if (this.consume(/\[/y)) {
            const m = this.consume(/((?:[^\\\]]|\\.)*)\]\]/y);
            if (!m) {
              throw new Error("Unmatched `[[`");
            }
            const linkBoxFull = m[1];
            console.log(linkBoxFull);
            const hasRightArrow = linkBoxFull.includes("->");
            const hasLeftArrow = linkBoxFull.includes("<-");
            const hasPipe = linkBoxFull.includes("|");
            const sum = Number(hasRightArrow) + Number(hasLeftArrow) + Number(hasPipe);
            if (sum > 1) {
              output.push({
                type: "error",
                message: "Link boxes can only have one of '->', '<-', or '|'",
                locationSample: `[[${linkBoxFull}]]`,
              });
            } else if (sum === 0) {
              output.push({ type: "linkBox", link: linkBoxFull, text: linkBoxFull });
            } else {
              const separator = hasRightArrow ? "->" : hasLeftArrow ? "<-" : "|";
              output.push(makeLinkBox(linkBoxFull, separator));
            }
          } else {
            output.push("[");
          }
          break;

        case "(":
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
        console.warn(`Ignoring duplicate attribute '${key}`);
      }
      attrs.set(key, value);
    }

    const content = UNCLOSED_TAGS.includes(name) ? [] : this.parse(new RegExp(`</${name}>`, "y"));

    return new ElementTemplate(name, attrs, content);
  }

  parseMacro(): MacroTemplate {
    const match = this.consume(RE.macroInvoke);
    if (!match) {
      throw new Error("Unescaped '@'");
    }
    const macroName = match[0];

    let args: string[] | null = null;
    if (this.consume(/\s*\(/y)) {
      args = macroName === "for" ? this.parseForArgs() : this.parseJsArgs();
    }

    const hasContent = this.consume(/\s*\{/y);
    if (!args && !hasContent) {
      throw new Error("Macro invocations require (arguments) or a { body }");
    }
    const content = hasContent ? this.parse(/\}/y) : [];

    return new MacroTemplate(macroName, args || [], content);
  }

  parseForArgs(): string[] {
    // TODO refine this
    const match = this.consume(/\s*([^]*?)\s+of\b/y);
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

        case "_":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            output.push("Brick.temp.", match[0]);
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

function makeLinkBox(fullText: string, separator: string): LinkBox {
  const split = fullText.split(separator);
  if (split.length <= 1) {
    throw new Error(`makeLinkBox: fulltext did not contain "${separator}"`);
  }
  if (split.length >= 3) {
    throw new Error(`Links in [[...]] can only contain "${separator}" once`);
  }
  if (separator === "<-") {
    return { type: "linkBox", link: split[0], text: split[1] };
  } else {
    return { type: "linkBox", link: split[1], text: split[0] };
  }
}
