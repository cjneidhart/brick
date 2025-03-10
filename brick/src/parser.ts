import { constants } from "./engine";
import { BrickError } from "./error";
import { BRICK_MACRO_SYMBOL, isMacro } from "./macros";
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
    number: /[0-9][0-9_]*/y,
    operator: /[!%&*+-<=>^|~]+/y,
    regexp: /(?:[^\\[/]|\\.|\[(?:[^\\\]]|\\.)*\])*\/\p{ID_Continue}*/uy,
    stringDouble: /"(?:[^\\"\r\n]|\\[^])*"/y,
    stringSingle: /'(?:[^\\'\r\n]|\\[^])*'/y,
    normalInTemplateString: /(?:[^`$\\]|\\[^]|\$(?!\{))*/y,
  },
  macroArgsStart: / *\(/y,
  macroBodyStart: /\s*\{/y,
  macroName: /[-\p{ID_Start}][-\p{ID_Continue}]*|=/uy,
  markdown: {
    whitespace: /[\p{gc=Zs}\t\n\f\r]/uy,
    punctuation: /[\p{gc=P}\p{gc=S}]/uy,
    punctuationOrWhitespace: /[\p{gc=P}\p{gc=S}\p{gc=Zs}\t\n\f\r]/uy,
  },
  maybeElementClose: /\/[-\p{ID_Continue}]+(?: *>)?/uy,
  newlines: /\s*[\r\n]\s*/y,
  normalChars: /[^[\\$_?<@/}\r\n*]+/y,
  singleChar: /[^]/y,
  stars: /\**/y,
  styleElement: /([^]*?)<\/style>/y,
  whitespace: /\s*/y,
  wikiLink: /((?:[^\\\]\r\n]|\\.)*)\]\]/y,
};

/** Tags which are not allowed to be descended from `<body>` */
const BANNED_TAGS = ["base", "body", "link", "head", "html", "meta", "script", "title"];

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

export interface ParagraphBreak extends NodeTemplateBase {
  type: "paragraph-break";
  raw: string;
}

export interface ElementTemplate extends NodeTemplateBase {
  type: "element";
  name: string;
  attributes?: Map<string, string>;
  evalAttributes?: Map<string, string>;
  content: NodeTemplate[];
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

export interface Expr extends NodeTemplateBase {
  type: "expr";
  store: "constants" | "story" | "temp";
  base: string;
  ops: PostscriptOp[];
  content?: NodeTemplate[];
}

export interface PostscriptIndex {
  type: "index";
  key: string;
  needsEval: boolean;
  raw: string;
}

export interface PostscriptCall {
  type: "call";
  args: string[];
  raw: string;
}

type PostscriptOp = PostscriptCall | PostscriptIndex;

export interface MacroChain extends NodeTemplateBase {
  type: "chain";
  segments: MacroChainSegment[];
}

export interface MacroChainSegment {
  name: string;
  args: string[];
  body: NodeTemplate[];
}

export type NodeTemplate =
  | string
  | ParagraphBreak
  | ElementTemplate
  | Expr
  | MacroChain
  | LinkBox
  | ErrorMessage;

interface Delimiter {
  length: number;
  originalLength: number;
  canOpen: boolean;
  canClose: boolean;
  originalCanClose: boolean;
  /** Index into the output array */
  index: number;
}

export class Parser {
  input: string;
  index: number;
  passageName: string;
  lineNumber: number;

  constructor(source: string, passageName: string, lineNumber?: number) {
    // Convert all line breaks to \n and remove trailing whitespace
    this.input = source
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n")
      // EcmaScript whitespace definition
      // U+0020 (SPACE) and U+00A0 (NO-BREAK SPACE) are part of "Space_Separator"
      .replaceAll(/[\t\v\f\ufeff\p{Space_Separator}]+\n/gu, "\n");
    this.index = 0;
    this.passageName = passageName;
    this.lineNumber = lineNumber || 1;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
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

  error(message: string): never {
    throw new BrickError(message, this.passageName, this.lineNumber);
  }

  parse(closer?: RegExp): NodeTemplate[] {
    const output: NodeTemplate[] = [];
    const delimiters: Delimiter[] = [];

    let prevIndex = -1;
    outer: while (this.index < this.input.length) {
      if (this.index === prevIndex) {
        this.error("Parser stuck in infinite loop");
      }
      prevIndex = this.index;

      const startIndex = this.index;
      this.consume(RE.normalChars);
      if (this.index !== startIndex) {
        output.push(this.input.substring(startIndex, this.index));
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
          output.push(this.parseExpr("constants"));
          break;

        case "/":
          switch (this.lookahead()) {
            case "/":
              this.consume(RE.commentLine);
              break;
            case "*":
              if (!this.consume(RE.commentBlock)) {
                this.error("Missing trailing `*/` to close the block comment");
              }
              break;
            default:
              output.push(c);
              break;
          }
          break;

        case "$":
          output.push(this.parseExpr("story"));
          break;

        case "_":
          output.push(this.parseExpr("temp"));
          break;

        case "[":
          if (this.lookahead() === "[") {
            this.index++;
            const m = this.consume(RE.wikiLink);
            if (!m) {
              this.error("Unmatched `[[`");
            }
            const linkBoxFull = m[1];
            const hasRightArrow = linkBoxFull.includes("->");
            const hasLeftArrow = linkBoxFull.includes("<-");
            const hasPipe = linkBoxFull.includes("|");
            const separatorCount = Number(hasRightArrow) + Number(hasLeftArrow) + Number(hasPipe);
            if (separatorCount > 1) {
              this.error("Link boxes can only have one of '->', '<-', or '|'");
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

        case "}":
          output.push("}");
          break;

        case "*": {
          const delimiter = this.createDelimiter(output.length);
          delimiters.push(delimiter);
          output.push("*".repeat(delimiter.length));
          break;
        }

        case "\r":
        case "\n": {
          const lineNumber = this.lineNumber + (c === "\n" ? -1 : 0);
          const match = this.consume(RE.newlines);
          if (match) {
            output.push({
              type: "paragraph-break",
              lineNumber,
              passageName: this.passageName,
              raw: c + match[0],
            });
          } else {
            output.push(c);
          }
          break;
        }

        case undefined:
          // end of input
          break outer;

        default:
          throw new Error(`Logic Error (${c})`);
      }
    }

    if (closer && !this.consume(closer)) {
      this.error(`Failed to match regex "${closer.source}"`);
    }

    // Transform "*" delimiters into <em> and <strong>
    while (true) {
      // Find the first closer in the list
      const closerIndex = delimiters.findIndex((delimiter) => {
        return delimiter.canClose && delimiter.length > 0;
      });
      if (closerIndex === -1) {
        // If we don't find any closers, we're done
        break;
      }
      const closer = delimiters[closerIndex];

      // `openerIndex` and `closerIndex` are indices into `delimiters`
      // `opener.index` and `closer.index` are indices into `output`
      // Sorry :)

      // Search backwards for an opener
      let openerIndex = closerIndex - 1;
      let opener;
      while (openerIndex >= 0) {
        opener = delimiters[openerIndex];
        if (opener.canOpen && opener.length > 0) {
          const isOddMatch =
            (opener.originalCanClose || closer.canOpen) &&
            closer.originalLength % 3 !== 0 &&
            (opener.originalLength + closer.originalLength) % 3 === 0;
          if (!isOddMatch) {
            break;
          }
        }
        openerIndex--;
      }
      if (!opener || openerIndex === -1) {
        // If an opener isn't found, we know this delimiter is not a closer
        closer.canClose = false;
        continue;
      }

      const isStrong = closer.length >= 2 && opener.length >= 2;
      const delimiterLength = isStrong ? 2 : 1;

      // Shorten the delimiters and their corresponding strings in the output
      opener.length -= delimiterLength;
      closer.length -= delimiterLength;
      output[opener.index] = (output[opener.index] as string).slice(delimiterLength);
      output[closer.index] = (output[closer.index] as string).slice(delimiterLength);

      // Wrap all templates between the delimiter in an <em> or <strong>
      const children = output.slice(opener.index + 1, closer.index);
      const template: ElementTemplate = {
        type: "element",
        content: children,
        lineNumber: 0,
        passageName: this.passageName,
        name: isStrong ? "strong" : "em",
      };
      output.splice(opener.index + 1, children.length, template);

      // Adjust the indices for any delimiters after the opener, since output's length has changed
      for (const delimiter of delimiters.slice(openerIndex + 1)) {
        delimiter.index -= children.length - 1;
      }
    }

    return output;
  }

  createDelimiter(indexIntoOutput: number): Delimiter {
    const beforeIndex = this.index - 2;
    const length = 1 + (this.consume(RE.stars)?.[0].length ?? 0);
    const afterIndex = this.index;
    let charBefore = this.input[beforeIndex] ?? " ";
    const charBeforeCodePoint = charBefore.codePointAt(0);
    // If the prior character is a surrogate, retrieve the whole pair
    if (
      typeof charBeforeCodePoint === "number" &&
      charBeforeCodePoint >= 0xd800 &&
      charBeforeCodePoint <= 0xdfff
    ) {
      charBefore = this.input.slice(beforeIndex - 1, beforeIndex + 1);
    }

    const codePointAfter = this.input.codePointAt(afterIndex);
    const charAfter =
      typeof codePointAfter === "number" ? String.fromCodePoint(codePointAfter) : " ";

    const { whitespace, punctuation, punctuationOrWhitespace } = RE.markdown;

    const canOpen =
      !whitespace.test(charAfter) &&
      (!punctuation.test(charAfter) ||
        (punctuation.test(charAfter) && punctuationOrWhitespace.test(charBefore)));
    const canClose =
      !whitespace.test(charBefore) &&
      (!punctuation.test(charBefore) ||
        (punctuation.test(charBefore) && punctuationOrWhitespace.test(charAfter)));

    return {
      index: indexIntoOutput,
      canClose,
      canOpen,
      length,
      originalLength: length,
      originalCanClose: canClose,
    };
  }

  parseExpr(store: "constants" | "story" | "temp"): Expr | MacroChain {
    const { lineNumber } = this;
    let base = "";
    if (store !== "constants" || this.lookahead() !== "(") {
      const match = this.consume(RE.macroName);
      if (!match) {
        const storeChar = { constants: "@", story: "$", temp: "_" }[store];
        throw Error(`Unescaped "${storeChar}"`);
      }
      base = match[0];
    }

    if (store === "constants") {
      const macro = constants[base];
      if (isMacro(macro)) {
        const macroOpts = macro[BRICK_MACRO_SYMBOL];
        if (typeof macroOpts === "object") {
          if (macroOpts.chainWith) {
            return this.parseMacroChain(base, macroOpts.chainWith);
          } else if (macroOpts.isForMacro) {
            return this.parseForMacro();
          }
        }
      }
    }

    const ops: PostscriptOp[] = [];
    outerLoop: while (true) {
      const opStartIdx = this.index;
      switch (this.lookahead()) {
        case "(": {
          this.index++;
          const args = this.parseJsArgs(")");
          if (!(args instanceof Array)) {
            throw Error();
          }
          const raw = this.input.slice(opStartIdx, this.index);
          ops.push({ type: "call", args, raw });
          break;
        }

        case "[": {
          this.index++;
          const args = this.parseJsArgs("]");
          if (!(args instanceof Array)) {
            throw Error();
          }
          ops.push({
            type: "index",
            key: args.join(","),
            needsEval: true,
            raw: this.input.slice(opStartIdx, this.index),
          });
          break;
        }

        case ".": {
          this.index++;
          const match = this.consume(RE.js.identifier);
          if (match) {
            ops.push({
              type: "index",
              key: match[0],
              needsEval: false,
              raw: this.input.slice(opStartIdx, this.index),
            });
          } else {
            this.index--;
            break outerLoop;
          }
          break;
        }

        case " ":
          if (store === "constants" && ops.length === 0) {
            this.index++;
          } else {
            break outerLoop;
          }
          break;

        default:
          break outerLoop;
      }
    }

    const content = this.consume(RE.macroBodyStart) ? this.parse(/\}/y) : undefined;

    return {
      type: "expr",
      lineNumber,
      passageName: this.passageName,
      store,
      base,
      ops,
      content,
    };
  }

  parseMacroChain(firstName: string, chainNameRe: RegExp): MacroChain {
    const lineNumber = this.lineNumber;
    if (!this.consume(RE.macroArgsStart)) {
      throw "todo";
    }

    const firstArgs = this.parseJsArgs(")");
    if (!(firstArgs instanceof Array)) {
      throw Error("todo'):");
    }
    if (!this.consume(RE.macroBodyStart)) {
      throw "error";
    }
    const firstBody = this.parse(/\}/y);
    let indexAfterRBrace = this.index;

    const blocks = [{ name: firstName, args: firstArgs, body: firstBody }];
    const nameRegExp = chainNameRe.sticky
      ? chainNameRe
      : new RegExp(chainNameRe, chainNameRe.flags + "y");
    while (this.consume(/\s*@/y)) {
      const match = this.consume(nameRegExp);
      if (!match) {
        this.index = indexAfterRBrace;
        break;
      }
      const name = match[0];

      let args: string[] = [];
      if (this.lookahead() === "(") {
        const maybeArgs = this.parseJsArgs(")");
        if (!(maybeArgs instanceof Array)) {
          throw "ererdsaf";
        }
        args = maybeArgs;
      }

      let body: NodeTemplate[] = [];
      if (this.consume(RE.macroBodyStart)) {
        body = this.parse(/\}/y);
        indexAfterRBrace = this.index;
      }

      blocks.push({ name, args, body });
    }

    const macro: MacroChain = {
      type: "chain",
      passageName: this.passageName,
      lineNumber,
      segments: blocks,
    };

    return macro;
  }

  parseForMacro(): Expr {
    const { lineNumber } = this;
    if (!this.consume(RE.macroArgsStart)) {
      throw "bad for";
    }
    const argsStartIdx = this.index - 1;
    const args = this.parseForArgs();
    if (!(args instanceof Array)) {
      throw args;
    }
    const raw = this.input.slice(argsStartIdx, this.index);

    const body = this.consume(RE.macroBodyStart) ? this.parse(/\}/y) : undefined;

    return {
      type: "expr",
      passageName: this.passageName,
      lineNumber,
      store: "constants",
      base: "for",
      ops: [{ type: "call", args, raw }],
      content: body,
    };
  }

  parseElement(): ElementTemplate | ErrorMessage {
    const longName = this.consume(RE.elementName);
    if (!longName) {
      const closeTag = this.consume(RE.maybeElementClose);
      if (closeTag) {
        this.error(`Unexpected closing tag "${closeTag[0]}"`);
      }

      this.error(
        "Element names can contain only hyphens, underscores, and ASCII letters and numbers. " +
          'The "<" character must be escaped with a "\\" backslash if not used as an HTML element.',
      );
    }

    const [, casedName, id, className] = longName;
    const name = casedName.toLowerCase();

    let attributes: Map<string, string> | undefined = undefined;
    let evalAttributes: Map<string, string> | undefined = undefined;
    if (id) {
      attributes ??= new Map();
      attributes.set("id", id.slice(1));
    }
    if (className.length) {
      attributes ??= new Map();
      attributes.set("class", className.replace(".", " ").trim());
    }

    this.consume(RE.whitespace);
    while (!this.consume(RE.closeTag)) {
      let match = this.consume(RE.htmlAttr);
      if (match) {
        const [_, key, value] = match;
        if (attributes?.has(key) || evalAttributes?.has(key)) {
          console.warn(`Ignoring duplicate attribute '${key}`);
        } else {
          attributes ??= new Map();
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
            this.error(`Empty JavaScript attribute "${key}"`);
          }
          if (this.lookahead() !== ")") {
            this.error(`No closing paren on dynamic attribute "${key}"`);
          }
          this.index++;
          if (attributes?.has(key) || evalAttributes?.has(key)) {
            console.warn(`Ignoring duplicate attribute '${key}`);
          } else {
            evalAttributes ??= new Map();
            evalAttributes.set(key, value);
          }
        } else {
          this.error("Missing trailing `>` to close the HTML tag");
        }
      }
    }

    let content: NodeTemplate[];
    if (name === "style") {
      const match = this.consume(RE.styleElement);
      if (!match) {
        throw new Error("No closing </style> found");
      }
      content = [match[1]];
    } else if (VOID_TAGS.includes(name)) {
      content = [];
    } else {
      content = this.parse(new RegExp(`</${name}>`, "y"));
    }

    if (BANNED_TAGS.includes(name)) {
      this.error(`Passages cannot contain "<${name}>" elements`);
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

  parseForArgs(): string[] | ErrorMessage {
    // TODO refine this
    const match = this.consume(/\s*([^]*?)\s+of\b/y);
    if (!match) {
      this.error("Syntax: @for(_VAR of EXPRESSION)");
    }

    const loopVar = match[1];
    const loopCond = this.parseJsExpression();
    if (typeof loopCond === "object") {
      return loopCond;
    }
    if (loopCond.trim() === "") {
      this.error("Syntax: @for(_VAR of EXPRESSION)");
    }

    if (!this.consume(/\s*\)/y)) {
      this.error("@for: missing closing ')'");
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
      this.error(`Missing a closing \`${closer}\``);
    }
    this.index++;

    return args;
  }

  parseJsExpression(): string | ErrorMessage {
    const nesting = [];
    const output = [];
    let regexpAllowed: boolean | null = true;
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
            this.error("Unclosed double-quoted string");
          }
          break;

        case "'":
          match = this.consume(RE.js.stringSingle);
          if (match) {
            output.push(match[0]);
            regexpAllowed = false;
          } else {
            this.error("Unclosed single-quoted string");
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
        case "_":
        case "@":
          this.index++;
          match = this.consume(RE.js.identifier);
          if (match) {
            const prefix =
              c === "$" ? "engine.vars." : c === "_" ? "brickTempVarScope." : "constants.";
            output.push(prefix, match[0]);
            regexpAllowed = false;
          } else {
            this.error("Illegal identifier");
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
          } else if (regexpAllowed === null) {
            this.error(
              `"/" is not allowed after "}". ` +
                `If the bracket is part of an object initializer, wrap it in parentheses "({ })". ` +
                `If the bracket is part of a block statement, place a semicolon ";" after it.`,
            );
          } else if (regexpAllowed) {
            output.push(c);
            match = this.consume(RE.js.regexp);
            if (!match) {
              this.error("Invalid RegExp literal");
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
            regexpAllowed = c === "}" ? null : false;
            break;
          }

          if (![")", "]", "}"].includes(c || "")) {
            this.error(`Can't handle unescaped ${c} yet`);
          }
          break outer;
      }
    }

    if (nesting.length > 0) {
      this.error(`Expected a "${nesting.pop()}"`);
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
        this.error("Unclosed template string");
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
            this.error('missing "}" inside template string');
          }
          this.index++;
          output.push("}");
          break;
        }

        default:
          this.error(`Logic Error: '${c}' (U+${c.charCodeAt(0)}) was not matched by regex`);
      }
    }
  }

  makeLinkBox(fullText: string, separator: string): LinkBox | ErrorMessage {
    const split = fullText.split(separator);
    if (split.length !== 2) {
      this.error(`Links in [[...]] can only contain "${separator}" once`);
    }
    if (separator === "<-") {
      return {
        type: "linkBox",
        passageName: this.passageName,
        lineNumber: this.lineNumber,
        link: split[0].trim(),
        text: split[1].trim(),
      };
    } else {
      return {
        type: "linkBox",
        passageName: this.passageName,
        lineNumber: this.lineNumber,
        link: split[1].trim(),
        text: split[0].trim(),
      };
    }
  }

  toString() {
    return "[object Parser]";
  }
}
