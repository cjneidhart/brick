const RE = {
  closeTag: />/y,
  commentBlock: /\*(?:[^])*?\*\//y,
  commentLine: /\/.*\n?/y,
  elementName: /([-\p{ID_Continue}]+)(#[-\p{ID_Continue}]+)?((?:\.[-\p{ID_Continue}]+)*)/uy,
  htmlAttr: /\s*([-_\p{ID_Start}][-\p{ID_Continue}]*)="([^"]*)"/uy,
  htmlEvalAttr: /\s*([-_\p{ID_Start}][-\p{ID_Continue}]*)=\(/uy,
  js: {
    closingParen: /\s*\)/y,
    closingSquareBracket: /\s*\]/y,
    field: /\.\p{ID_Start}[$\p{ID_Continue}]*/uy,
    identifier: /\p{ID_Start}[$\p{ID_Continue}]*/uy,
    normalChars: /[^"'`[\]{}()/$_,a-zA-Z]+/y,
    stringDouble: /"(?:[^\\"]|\\[^])*"/y,
    stringSingle: /'(?:[^\\']|\\[^])*'/y,
    normalInTemplateString: /(?:[^`$\\]|\\[^]|\$(?!\{))*/y,
  },
  macroArgsStart: / *\(/y,
  macroBodyStart: /\s*\{/y,
  macroName: /[-_=<>\p{ID_Start}][-=<>\p{ID_Continue}]*/uy,
  normalChars: /[^[\]{}\\($_?<@/]+/y,
  singleChar: /[^]/y,
  whitespace: /\s*/y,
};

/** Tags which are not allowed to be descended from `<body>` */
const BANNED_TAGS = ["base", "body", "link", "head", "html", "meta", "script", "style", "title"];

/** Tags which can't have child nodes */
const VOID_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

export interface ElementTemplate {
  type: "element";
  name: string;
  attributes: Map<string, string>;
  evalAttributes: Map<string, string>;
  content: NodeTemplate[];
}

// Represents a not-yet-invoked macro
export interface MacroTemplate {
  type: "macro";
  name: string;
  args: string[];
  content?: NodeTemplate[];
}

export interface NakedVariable {
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
  | NakedVariable
  | LinkBox
  | ErrorMessage;

export function isMacro(nt: NodeTemplate): nt is MacroTemplate {
  return typeof nt === "object" && nt.type === "macro";
}

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

  locationSample(): string {
    // edge case: we are at a line break
    if (this.input[this.index] === "\n") {
      const start = this.input.lastIndexOf("\n", this.index - 1) + 1;
      return this.input.slice(start, this.index);
    }
    // This will be zero if a newline is not found
    const start = this.input.lastIndexOf("\n", this.index - 1) + 1;
    const end = this.input.indexOf("\n", this.index + 1);
    return this.input.slice(start, end);
  }

  error(message: string): ErrorMessage {
    return { type: "error", message, locationSample: this.locationSample() };
  }

  parse(closer?: RegExp): NodeTemplate[] {
    const output: NodeTemplate[] = [];

    let iterations = 0;
    outer: while (this.index < this.input.length) {
      if (iterations >= 1_000_000) {
        output.push(this.error("Parser stuck in infinite loop"));
        return output;
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
            // Assume they meant to place an escaped newline, that got trimmed.
            output.push("\n");
          } else {
            output.push(c2);
          }
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
                output.push(this.error("Missing trailing `*/` to close the block comment"));
                return output;
              }
              break;
            default:
              output.push(c);
              break;
          }
          break;

        case "$": {
          output.push(this.parseNakedVariable("story"));
          break;
        }

        case "_": {
          output.push(this.parseNakedVariable("temp"));
          break;
        }

        case "[":
          if (this.lookahead() === "[") {
            this.index++;
            const m = this.consume(/((?:[^\\\]]|\\.)*)\]\]/y);
            if (!m) {
              throw new Error("Unmatched `[[`");
            }
            const linkBoxFull = m[1];
            const hasRightArrow = linkBoxFull.includes("->");
            const hasLeftArrow = linkBoxFull.includes("<-");
            const hasPipe = linkBoxFull.includes("|");
            const separatorCount = Number(hasRightArrow) + Number(hasLeftArrow) + Number(hasPipe);
            if (separatorCount > 1) {
              output.push(this.error("Link boxes can only have one of '->', '<-', or '|'"));
            } else if (separatorCount === 0) {
              output.push({ type: "linkBox", link: linkBoxFull, text: linkBoxFull });
            } else {
              const separator = hasRightArrow ? "->" : hasLeftArrow ? "<-" : "|";
              output.push(this.makeLinkBox(linkBoxFull, separator));
            }
          } else {
            output.push("[");
          }
          break;

        case "]":
        case "?":
        case ">":
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

  parseElement(): ElementTemplate | ErrorMessage {
    const longName = this.consume(RE.elementName);
    if (!longName) {
      return this.error(
        "Element names can contain only hyphens, underscores, and ASCII letters and numbers",
      );
    }

    const [_, name, id, className] = longName;

    const attributes = new Map<string, string>();
    const evalAttributes = new Map<string, string>();
    if (id) {
      attributes.set("id", id.slice(1));
    }
    if (className.length) {
      attributes.set("class", className.replace(".", " ").trim());
    }

    this.consume(RE.whitespace);
    while (!this.consume(RE.closeTag)) {
      let match = this.consume(RE.htmlAttr);
      if (match) {
        const [_, key, value] = match;
        if (attributes.has(key) || evalAttributes.has(key)) {
          console.warn(`Ignoring duplicate attribute '${key}`);
        } else {
          attributes.set(key, value);
        }
      } else {
        match = this.consume(RE.htmlEvalAttr);
        if (match) {
          const key = match[1];
          const value = this.parseJsExpression();
          if (value.trim() === "") {
            throw new Error(`Empty JavaScript attribute "${key}"`);
          }
          if (this.lookahead() !== ")") {
            throw new Error(`No closing paren on dynamic attribute "${key}"`);
          }
          this.index++;
          if (attributes.has(key) || evalAttributes.has(key)) {
            console.warn(`Ignoring duplicate attribute '${key}`);
          } else {
            evalAttributes.set(key, value);
          }
        } else {
          return this.error("Missing trailing `>` to close the HTML tag");
        }
      }
    }

    const content = VOID_TAGS.includes(name) ? [] : this.parse(new RegExp(`</${name}>`, "y"));

    if (BANNED_TAGS.includes(name)) {
      return this.error(`Passages cannot contain "<${name}>" elements`);
    }
    return { type: "element", name, attributes, evalAttributes, content };
  }

  parseNakedVariable(type: "story" | "temp"): NakedVariable | MacroTemplate | ErrorMessage {
    const startIdx = this.index;
    let match = this.consume(RE.js.identifier);
    if (!match) {
      const leadingChar = type === "story" ? "$" : "_";
      const bs = "or escaped with a backslash `\\`";
      return this.error(`${leadingChar} must be part of a ${type} variable, ${bs}`);
    }
    const baseVarName = match[0];
    const suffixStart = this.index;
    while (true) {
      switch (this.lookahead()) {
        case ".":
          match = this.consume(RE.js.field);
          if (match) {
            continue;
          }
          // not a match: break out, the period will be treated as plain markup later
          break;

        case "[":
          this.index++;
          this.parseJsArgs("]");
          continue;

        case "(":
          this.index++;
          this.parseJsArgs(")");
          continue;
      }

      break;
    }

    if (this.index === suffixStart) {
      // simple: just a plain variable
      return { type, name: baseVarName };
    } else {
      // more complicated: substitute with @print
      const prefix = type === "story" ? "Engine.vars." : "Engine.temp.";
      return {
        type: "macro",
        name: "print",
        args: [prefix + this.input.substring(startIdx, this.index)],
      };
    }
  }

  parseMacro(): MacroTemplate | ErrorMessage {
    const match = this.consume(RE.macroName);
    let macroName;
    if (match) {
      macroName = match[0];
    } else {
      // edge case: unnamed macro
      if (this.lookahead() === "(") {
        macroName = "";
      } else {
        return this.error("`@` must be followed by a macro name, or be escaped with a `\\`");
      }
    }

    let args: string[] | null = null;
    if (this.consume(RE.macroArgsStart)) {
      args = macroName === "for" ? this.parseForArgs() : this.parseJsArgs(")");
    }

    const hasContent = this.consume(RE.macroBodyStart);
    if (!args && !hasContent) {
      return this.error("Macro invocations must be followed by `(` or `[`");
    }
    const content = hasContent ? this.parse(/\}/y) : undefined;

    return {
      type: "macro",
      name: macroName,
      args: args || [],
      content,
    };
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

    if (!this.consume(/\s*\)/y)) {
      throw new Error("No closing paren");
    }

    return [loopVar, loopCond];
  }

  parseJsArgs(closer: "]" | ")"): string[] {
    const args = [];
    let arg;
    while ((arg = this.parseJsExpression())) {
      args.push(arg);
      if (!this.consume(/\s*,/uy)) {
        break;
      }
    }

    this.consume(RE.whitespace);
    if (this.lookahead() !== closer) {
      throw new Error(`Missing a closing \`${closer}\``);
    }
    this.index++;

    return args;
  }

  parseJsExpression(): string {
    const nesting = [];
    const output = [];
    let match;
    outer: while (this.index < this.input.length) {
      match = this.consume(RE.js.normalChars);
      if (match) {
        output.push(match[0]);
      }

      match = this.consume(RE.js.identifier);
      if (match) {
        output.push(match[0]);
        continue;
      }

      const c = this.lookahead();
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

        case "`":
          this.index++;
          output.push(c);
          this.parseJsTemplateString(output);
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
            output.push("Engine.vars.", match[0]);
          } else {
            throw new Error("Illegal identifier");
          }
          break;

        case "_":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            output.push("Engine.temp.", match[0]);
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

  parseJsTemplateString(output: string[]) {
    while (true) {
      const match = this.consume(RE.js.normalInTemplateString);
      if (match) {
        output.push(match[0]);
      }
      const c = this.lookahead();
      if (!c) {
        throw new Error("Unclosed template string");
      }
      switch (c) {
        case "`":
          output.push(c);
          this.index++;
          return;
        case "$":
          // from regex, we already know the left bracket is present
          this.index += 2;
          output.push("${");
          output.push(this.parseJsExpression());
          if (this.lookahead() !== "}") {
            throw Error('missing "}" inside template string');
          }
          this.index++;
          output.push("}");
          break;
        default:
          throw Error(`Logic Error: '${c}' (U+${c.charCodeAt(0)}) was not matched by regex`);
      }
    }
  }

  makeLinkBox(fullText: string, separator: string): LinkBox | ErrorMessage {
    const split = fullText.split(separator);
    if (split.length !== 2) {
      const msg = `Links in [[...]] can only contain "${separator}" once`;
      return this.error(msg);
    }
    if (separator === "<-") {
      return { type: "linkBox", link: split[0], text: split[1] };
    } else {
      return { type: "linkBox", link: split[1], text: split[0] };
    }
  }
}
