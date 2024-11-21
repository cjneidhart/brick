import { countSubstrings } from "./util";

const RE = {
  closeTag: />/y,
  commentBlock: /\*(?:[^])*?\*\//y,
  commentLine: /\/.*\n?/y,
  elementName: /([-\p{ID_Continue}]+)(#[-\p{ID_Continue}]+)?((?:\.[-\p{ID_Continue}]+)*)/uy,
  htmlAttr: /\s*([-_\p{ID_Start}][-\p{ID_Continue}]*)="([^"]*)"/uy,
  htmlEvalAttr: /\s*([-_\p{ID_Start}][-\p{ID_Continue}]*)=\(/uy,
  js: {
    binaryOperator: /[%&*<=>^|]+/y,
    closingParen: /\s*\)/y,
    closingSquareBracket: /\s*\]/y,
    field: /\.\p{ID_Start}[$\p{ID_Continue}]*/uy,
    identifier: /\p{ID_Start}[$\p{ID_Continue}]*/uy,
    number: /[0-9]+/y,
    operator: /[!%&*+-<=>^|~]+/y,
    regexp: /(?:[^\\[/]|\\[^]|\[(?:[^\\\]]|\\[^])*\])*\/(?:$|\p{ID_Continue})*/uy,
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

interface NodeTemplateBase {
  passageName: string;
  lineNumber: number;
}

export interface ElementTemplate extends NodeTemplateBase {
  type: "element";
  name: string;
  attributes: Map<string, string>;
  evalAttributes: Map<string, string>;
  content: NodeTemplate[];
}

// Represents a not-yet-invoked macro
export interface MacroTemplate extends NodeTemplateBase {
  type: "macro";
  name: string;
  args: string[];
  content?: NodeTemplate[];
}

export interface NakedVariable extends NodeTemplateBase {
  type: "story" | "temp";
  /** The name of the variable being accessed. */
  name: string;
}

/** A wiki-style [[Link]] */
export interface LinkBox extends NodeTemplateBase {
  type: "linkBox";
  link: string;
  text: string;
}

/** A parse error that should be displayed */
export interface ErrorMessage extends NodeTemplateBase {
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
  passageName: string;
  lineNumber: number;

  constructor(source: string, passageName: string, lineNumber?: number) {
    this.input = source;
    this.index = 0;
    this.passageName = passageName;
    this.lineNumber = lineNumber || 1;
  }

  consume(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.index;
    const match = pattern.exec(this.input);
    if (match) {
      // NOTE: if we need to improve parser performance, we could remove this call to
      // countSubstrings and instead store the index on each template, then use the index to later
      // find the line number as-needed.
      this.lineNumber += countSubstrings(match[0], "\n");
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
    return {
      type: "error",
      passageName: this.passageName,
      lineNumber: this.lineNumber,
      message,
      locationSample: this.locationSample(),
    };
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
          const c2 = this.consume(RE.singleChar);
          // Assume they meant to place an escaped newline, that got trimmed.
          output.push(c2?.[0] || "\n");
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
              output.push(this.error("Unmatched `[[`"));
              break;
            }
            const linkBoxFull = m[1];
            const hasRightArrow = linkBoxFull.includes("->");
            const hasLeftArrow = linkBoxFull.includes("<-");
            const hasPipe = linkBoxFull.includes("|");
            const separatorCount = Number(hasRightArrow) + Number(hasLeftArrow) + Number(hasPipe);
            if (separatorCount > 1) {
              output.push(this.error("Link boxes can only have one of '->', '<-', or '|'"));
            } else if (separatorCount === 0) {
              output.push({
                type: "linkBox",
                passageName: this.passageName,
                lineNumber: this.lineNumber,
                link: linkBoxFull,
                text: linkBoxFull,
              });
            } else {
              const separator = hasRightArrow ? "->" : hasLeftArrow ? "<-" : "|";
              output.push(this.makeLinkBox(linkBoxFull, separator));
            }
          } else {
            output.push("[");
          }
          break;

        case undefined:
          // end of input
          break outer;

        default:
          throw new Error(`Logic Error (${c})`);
      }
    }

    if (closer && !this.consume(closer)) {
      output.push(this.error(`Failed to match regex "${closer.source}"`));
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
          if (typeof value === "object") {
            return value;
          }
          if (value.trim() === "") {
            return this.error(`Empty JavaScript attribute "${key}"`);
          }
          if (this.lookahead() !== ")") {
            return this.error(`No closing paren on dynamic attribute "${key}"`);
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
    return {
      type: "element",
      passageName: this.passageName,
      lineNumber: this.lineNumber,
      name,
      attributes,
      evalAttributes,
      content,
    };
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
      return {
        type,
        passageName: this.passageName,
        lineNumber: this.lineNumber,
        name: baseVarName,
      };
    } else {
      // more complicated: substitute with @print
      const prefix = type === "story" ? "Engine.vars." : "Engine.temp.";
      return {
        type: "macro",
        name: "print",
        args: [prefix + this.input.substring(startIdx, this.index)],
        passageName: this.passageName,
        lineNumber: this.lineNumber,
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
      const argsResult = macroName === "for" ? this.parseForArgs() : this.parseJsArgs(")");
      if ("type" in argsResult) {
        return argsResult;
      }
      args = argsResult;
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
      passageName: this.passageName,
      lineNumber: this.lineNumber,
    };
  }

  parseForArgs(): string[] | ErrorMessage {
    // TODO refine this
    const match = this.consume(/\s*([^]*?)\s+of\b/y);
    if (!match) {
      return this.error("Syntax: @for(_VAR of EXPRESSION)");
    }

    const loopVar = match[1];
    const loopCond = this.parseJsExpression();
    if (typeof loopCond === "object") {
      return loopCond;
    }
    if (loopCond.trim() === "") {
      return this.error("Syntax: @for(_VAR of EXPRESSION)");
    }

    if (!this.consume(/\s*\)/y)) {
      return this.error("@for: missing closing ')'");
    }

    return [loopVar, loopCond];
  }

  parseJsArgs(closer: "]" | ")"): string[] | ErrorMessage {
    const args: string[] = [];
    let arg: string | ErrorMessage;
    while ((arg = this.parseJsExpression())) {
      if (typeof arg === "object") {
        return arg;
      }
      args.push(arg);
      if (!this.consume(/\s*,/uy)) {
        break;
      }
    }

    this.consume(RE.whitespace);
    if (this.lookahead() !== closer) {
      return this.error(`Missing a closing \`${closer}\``);
    }
    this.index++;

    return args;
  }

  parseJsExpression(): string | ErrorMessage {
    const nesting = [];
    const output = [];
    let regexpAllowed = true;
    let match;
    let lastIndex = 0;
    outer: while (this.index < this.input.length) {
      if (this.index === lastIndex) {
        throw new Error(`Infinite loop at index ${lastIndex} (${this.input[this.index]})`);
      } else {
        lastIndex = this.index;
      }
      match = this.consume(RE.whitespace);
      if (match) {
        output.push(match[0]);
      }

      match = this.consume(RE.js.identifier);
      if (match) {
        output.push(match[0]);
        regexpAllowed = false;
        continue;
      }

      // This doesn't fully lex a JS number, but the parts in between match the
      // "identifier" regex above and are handled the same
      match = this.consume(RE.js.number);
      if (match) {
        output.push(match[0]);
        regexpAllowed = false;
        continue;
      }

      // This only checks for simple cases of binary operators,
      // operators containing "!", "+", "-" or "~" are checked later.
      match = this.consume(RE.js.binaryOperator);
      if (match) {
        output.push(match[0]);
        regexpAllowed = true;
        continue;
      }

      const c = this.lookahead();
      switch (c) {
        case '"':
          match = this.consume(RE.js.stringDouble);
          if (match) {
            output.push(match[0]);
            regexpAllowed = false;
          } else {
            return this.error("Unclosed double-quoted string");
          }
          break;

        case "'":
          match = this.consume(RE.js.stringSingle);
          if (match) {
            output.push(match[0]);
            regexpAllowed = false;
          } else {
            return this.error("Unclosed single-quoted string");
          }
          break;

        case "`":
          this.index++;
          output.push(c);
          this.parseJsTemplateString(output);
          regexpAllowed = false;
          break;

        case "(":
          nesting.push(")");
          output.push(c);
          this.index++;
          regexpAllowed = true;
          break;

        case "[":
          nesting.push("]");
          output.push(c);
          this.index++;
          regexpAllowed = true;
          break;

        case "{":
          nesting.push("}");
          output.push(c);
          this.index++;
          regexpAllowed = false;
          break;

        case "$":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            output.push("Engine.vars.", match[0]);
            regexpAllowed = false;
          } else {
            return this.error("Illegal identifier");
          }
          break;

        case "_":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            output.push("Engine.temp.", match[0]);
            regexpAllowed = false;
          } else {
            return this.error("Illegal identifier");
          }
          break;

        case ",":
          if (nesting.length > 0) {
            // in a sub-expression, just continue
            this.index++;
            output.push(c);
            regexpAllowed = true;
          } else {
            // at outer level, end the expression
            break outer;
          }
          break;

        case "#":
        case ":":
        case ";":
        case "?":
        case ".":
          // for the above, either regexes are allowed or "/" is an error
          regexpAllowed = true;
          output.push(c);
          this.index++;
          break;

        case "!":
          this.index++;
          if (this.lookahead() === "=") {
            this.index++;
            if (this.lookahead() === "=") {
              this.index++;
              output.push("!==");
            } else {
              output.push("!=");
            }
            regexpAllowed = true;
          } else {
            output.push(c);
            regexpAllowed = false;
          }
          break;

        case "+":
        case "-":
          {
            output.push(c);
            this.index++;
            const lookahead = this.lookahead();
            if (lookahead === c) {
              output.push(lookahead);
              this.index++;
              regexpAllowed = false;
            } else if (lookahead === "=") {
              this.index++;
              regexpAllowed = true;
              output.push("=");
            } else {
              regexpAllowed = true;
            }
          }
          break;

        case "~":
          output.push(c);
          this.index++;
          regexpAllowed = true;
          break;

        case "/":
          this.index++;
          if (this.consume(RE.commentLine)) {
            output.push("\n");
          } else if ((match = this.consume(RE.commentBlock))) {
            if (match[0].includes("\n")) {
              output.push("\n");
            }
          } else if (regexpAllowed) {
            output.push(c);
            match = this.consume(RE.js.regexp);
            if (!match) {
              return this.error("Invalid RegExp literal");
            }
            output.push(match[0]);
            regexpAllowed = false;
          } else {
            output.push(c);
            regexpAllowed = true;
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
            return this.error(`Can't handle unescaped ${c} yet`);
          }
          break outer;
      }
    }

    if (nesting.length > 0) {
      return this.error(`Expected a "${nesting.pop()}"`);
    }

    return output.join("");
  }

  parseJsTemplateString(output: string[]): undefined | ErrorMessage {
    while (true) {
      const match = this.consume(RE.js.normalInTemplateString);
      if (match) {
        output.push(match[0]);
      }
      const c = this.lookahead();
      if (!c) {
        return this.error("Unclosed template string");
      }
      switch (c) {
        case "`":
          output.push(c);
          this.index++;
          return;

        case "$": {
          // from regex, we already know the left bracket is present
          this.index += 2;
          output.push("${");
          const expr = this.parseJsExpression();
          if (typeof expr === "object") {
            return expr;
          }
          output.push(expr);
          if (this.lookahead() !== "}") {
            return this.error('missing "}" inside template string');
          }
          this.index++;
          output.push("}");
          break;
        }

        default:
          return this.error(`Logic Error: '${c}' (U+${c.charCodeAt(0)}) was not matched by regex`);
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
      return {
        type: "linkBox",
        passageName: this.passageName,
        lineNumber: this.lineNumber,
        link: split[0],
        text: split[1],
      };
    } else {
      return {
        type: "linkBox",
        passageName: this.passageName,
        lineNumber: this.lineNumber,
        link: split[1],
        text: split[0],
      };
    }
  }
}
