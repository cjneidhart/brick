// https://github.com/klembot/twinejs/blob/develop/EXTENDING.md
// https://codemirror.net/5/doc/manual.html#modeapi

function startState() {
  return {
    blockComment: false,
    js: false,
    nesting: [],
    jsNesting: [],
    status: "default",
  };
}

const KEYWORDS = (
  "break case catch class const continue debugger default delete " +
  "do else export extends false finally for function if import in instanceof " +
  "new null return super switch this throw true try typeof var void while " +
  "with let static yield await enum implements interface package private " +
  "protected public arguments as async eval from get of set undefined"
).split(" ");

const OPERATORS = [
  "!",
  "!=",
  "!==",
  "%",
  "%=",
  "&",
  "&&",
  "&=",
  "&&=",
  "*",
  "**",
  "*=",
  "**=",
  "+",
  "++",
  "+=",
  "-",
  "--",
  "-=",
  "/",
  "/=",
  "<",
  "<<",
  "<=",
  "<<=",
  "=",
  "==",
  "===",
  "=>",
  ">",
  ">>",
  ">>>",
  ">=",
  ">>=",
  ">>>=",
  "^",
  "^=",
  "|",
  "||",
  "|=",
  "||=",
  "~",
];

const RE_NUMBER_ERROR = /^[_0-9.a-fA-F]+n?/;
// "I wish for a declarative method to express a lexical grammar"
// the programmer said, and the monkey's paw curled.
const RE_NUMBER_LEADING_ZERO =
  /^(?:[bB](?:_?[01])+n?|[oO](?:_?[0-7])+n?|[xX](?:_?[0-9a-fA-F])+n?|n|(?:\.(?:_?[0-9])*)?(?:[eE](?:_?[0-9])+)?)/;
const RE_POSTNUMBER_ERROR = /^[_0-9\p{ID_Start}]/u;

function postNumberCheck(stream) {
  return stream.match(RE_POSTNUMBER_ERROR) ? "error number" : "number";
}

function tokenJsNumber(stream, firstChar) {
  if (firstChar === "0") {
    if (stream.match(RE_NUMBER_LEADING_ZERO)) {
      return postNumberCheck(stream);
    } else if (stream.eol() || stream.peek().match(/^[^0-9\p{ID_Start}]/u)) {
      return postNumberCheck(stream);
    }
  } else if (firstChar === ".") {
    if (stream.match(/^(?:_?[0-9])+(?:[eE](?:_?[0-9])+)?/)) {
      return postNumberCheck(stream);
    }
  } else {
    if (
      stream.match(
        /^(?:(?:_?[0-9])*(?:\.(?:_?[0-9])*)?(?:[eE](?:_?[0-9])+)?|(?:_?[0-9])*n)/
      )
    ) {
      return postNumberCheck(stream);
    }
  }

  // Attempt to consume as many characters as possible, to make the error obvious
  stream.match(RE_NUMBER_ERROR);
  return "error number";
}

function tokenJs(stream, state) {
  if (stream.match(/^[!%&*+\-<=>^|~]+/)) {
    return OPERATORS.includes(stream.current()) ? "operator" : "error operator";
  }

  if (stream.match(/^@?[$_a-zA-Z][$_a-zA-Z0-9]*/)) {
    if (["$", "_", "@"].includes(stream.current()[0])) {
      return "variable-2";
    } else if (KEYWORDS.includes(stream.current())) {
      return "keyword";
    } else {
      return "variable";
    }
  }

  const c = stream.next();

  if (
    (c >= "0" && c <= "9") ||
    (c === "." && stream.peek() >= "0" && stream.peek() <= "9")
  ) {
    return tokenJsNumber(stream, c);
  }

  switch (c) {
    case "/":
      if (stream.peek() === "/") {
        stream.skipToEnd();
        return "comment";
      } else if (stream.peek() === "*") {
        stream.next();
        state.blockComment = true;
        return "comment";
      } else {
        stream.eat("=");
        return "operator";
      }

    case "(":
      state.jsNesting.push(")");
      return "bracket";
    case "{":
      state.jsNesting.push("}");
      return "bracket";
    case "[":
      state.jsNesting.push("]");
      return "bracket";

    case ")":
    case "}":
    case "]":
      if (c === state.jsNesting[state.jsNesting.length - 1]) {
        state.jsNesting.pop();
        if (state.jsNesting.length === 0) {
          state.js = false;
          return "bracket";
        } else {
          return "bracket";
        }
      } else {
        return "bracket error";
      }

    case '"':
      if (stream.match(/^(?:[^\\"]|\\[^]])*"/)) {
        return "string";
      } else {
        stream.skipToEnd();
        return "string error";
      }

    case "'":
      if (stream.match(/^(?:[^\\']|\\[^])*'/)) {
        return "string";
      } else {
        stream.skipToEnd();
        return "string error";
      }

    default:
      stream.eatSpace();
      return null;
  }
}

const miniModes = {
  closingTag(stream, state) {
    state.status = "default";
    if (stream.match(/^\s*>/)) {
      return "bracket";
    }
    stream.next();
    return "error";
  },

  closingTagPreName(stream, state) {
    if (stream.match(/\p{ID_Start}\p{ID_Continue}*(?:-\p{ID_Continue})*/u)) {
      state.status = "closingTag";
      return "tag";
    }
    state.status = "default";
    stream.next();
    return "error";
  },

  expectAttrValue(stream, state) {
    if (stream.match(/^"([^"]*)"/)) {
      state.status = "openTag";
      return "string";
    } else if (stream.match(/^".*/)) {
      state.status = "default";
      return "string error";
    } else if (stream.eat("(")) {
      state.js = true;
      state.jsNesting = [")"];
      state.status = "openTag";
      return "bracket";
    } else {
      state.status = "default";
      stream.next();
      return "error";
    }
  },

  exprFollowUp(stream, state) {
    if (stream.eat("[")) {
      state.jsNesting = ["]"];
      state.js = true;
      return "bracket";
    }

    if (stream.eat("(")) {
      state.jsNesting = [")"];
      state.js = true;
      return "bracket";
    }

    if (stream.eat(".")) {
      state.status = "exprPostDot";
      return "";
    }

    if (stream.match(/^\s*\{/)) {
      state.nesting.push("}");
      return "bracket";
    }

    state.status = "default";
    return token(stream, state);
  },

  exprPostDot(stream, state) {
    if (stream.match(/^\p{ID_Start}\p{ID_Continue}*/u)) {
      state.status = "exprFollowUp";
      return "variable-2";
    }

    state.status = "default";
    return token(stream, state);
  },

  macroFollowUp(stream, state) {
    if (stream.match(/^\s*\(/)) {
      state.jsNesting = [")"];
      state.js = true;
      state.status = "exprFollowUp";
      return "bracket";
    }

    return miniModes.exprFollowUp(stream, state);
  },

  openTag(stream, state) {
    if (state.maybeAttrEquals) {
      state.maybeAttrEquals = false;
      if (stream.eat("=")) {
        state.status = "expectAttrValue";
        return "";
      }
    }
    if (stream.match(/^\s*\/?>/)) {
      state.status = "default";
      return "bracket";
    }
    if (
      stream.match(/^\s*\p{ID_Start}\p{ID_Continue}*(?:-\p{ID_Continue})*/u)
    ) {
      state.maybeAttrEquals = true;
      return "attribute";
    }

    stream.next();
    state.status = "default";
    return "error";
  },

  openTagPreName(stream, state) {
    if (stream.match(/^\p{ID_Start}\p{ID_Continue}*(?:-\p{ID_Continue})*/u)) {
      state.status = "openTag";
      return "tag";
    } else {
      state.status = "default";
      stream.next();
      return "error";
    }
  },

  wikiLink(stream, state) {
    if (stream.match(/^->|<-|\|/)) {
      return "bracket";
    }

    if (stream.match("]]")) {
      state.status = "default";
      return "bracket";
    }

    if (stream.match(/^[^<|\-\]]+/)) {
      return null;
    }

    stream.next();
    return null;
  },
};

function token(stream, state) {
  if (state.blockComment) {
    if (stream.match(/^[^]*?\*\//)) {
      state.blockComment = false;
    } else {
      stream.skipToEnd();
    }
    return "comment";
  }

  if (state.js) {
    return tokenJs(stream, state);
  }

  if (state.status in miniModes) {
    return miniModes[state.status](stream, state);
  }

  const c = stream.next();

  switch (c) {
    case "@":
    case "$":
    case "_":
      if (
        stream.match(/^\p{ID_Start}\p{ID_Continue}*/u) ||
        (c === "@" && stream.peek() === "(")
      ) {
        state.status = c === "@" ? "macroFollowUp" : "exprFollowUp";
        return c === "@" ? "keyword" : "variable-2";
      } else {
        return "error";
      }

    case "/":
      if (stream.peek() === "/") {
        stream.skipToEnd();
        return "comment";
      } else if (stream.peek() === "*") {
        stream.next();
        state.blockComment = true;
        return "comment";
      } else {
        return null;
      }

    case "{":
      return "error";

    case "[":
      if (stream.eat("[")) {
        state.status = "wikiLink";
        return "bracket";
      }

    case "}":
      if (c === state.nesting.at(-1)) {
        state.nesting.pop();
        return "bracket";
      }
      return "error";

    case "\\":
      stream.next();
      return "atom";

    case "<": {
      const peek = stream.peek();
      if (/\p{ID_Start}/u.test(peek)) {
        state.status = "openTagPreName";
        return "bracket";
      } else if (peek === "/") {
        stream.next();
        state.status = "closingTagPreName";
        return "bracket";
      } else {
        return "bracket error";
      }
    }

    case ">":
      return "error";

    default:
      stream.match(/^[^$_/@{}\\<>\[]*/);
      return null;
  }
}

export function mode() {
  return { startState, token };
}

export function register(CodeMirror) {
  CodeMirror.defineMode("brick", mode);
}
