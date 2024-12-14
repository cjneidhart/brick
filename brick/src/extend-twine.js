// https://github.com/klembot/twinejs/blob/develop/EXTENDING.md
// https://codemirror.net/5/doc/manual.html#modeapi

function startState() {
  return {
    blockComment: false,
    expectMacroBody: false,
    js: false,
    nesting: [],
    jsNesting: [],
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

const RE_NUMBER_ERROR = /^[0-9.a-fA-F]+n?/;
// "I wish for a declarative method to express a lexical grammar"
// the programmer said, and the monkey's paw curled.
const RE_NUMBER_LEADING_ZERO =
  /^(?:[bB](?:_?[01])+n?|[oO](?:_?[0-7])+n?|[xX](?:_?[0-9a-fA-F])+n?|n|(?:\.(?:_?[0-9])*)?(?:[eE](?:_?[0-9])+)?)/;
const RE_POSTNUMBER_ERROR = /^[0-9\p{ID_Start}]/u;

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
    if (stream.match(/^(?:(?:_?[0-9])*(?:\.(?:_?[0-9])*)?(?:[eE](?:_?[0-9])+)?|(?:_?[0-9])*n)/)) {
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

  if (stream.match(/^[$_a-zA-Z][$_a-zA-Z0-9]*/)) {
    if (["$", "_"].includes(stream.current()[0])) {
      return "variable-3";
    } else if (KEYWORDS.includes(stream.current())) {
      return "keyword";
    } else {
      return "variable";
    }
  }

  const c = stream.next();

  if ((c >= "0" && c <= "9") || (c === "." && stream.peek() >= "0" && stream.peek() <= "9")) {
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
          state.expectMacroBody = true;
          stream.eatSpace();
          return "variable-2";
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

  const c = stream.next();
  if (state.expectMacroBody) {
    state.expectMacroBody = false;
    if (c === "{") {
      state.nesting.push("}");
      return "bracket";
    }
  }

  switch (c) {
    case "$":
    case "_":
      if (stream.match(/^[$_a-zA-Z]/)) {
        stream.match(/^[$_a-zA-Z0-9]*/);
        return "variable-3";
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

    case "@":
      if (stream.match(/^[a-zA-Z]*\s*\(/)) {
        state.jsNesting = [")"];
        state.js = true;
        return "variable-2";
      } else if (stream.match(/^[a-zA-Z]*\s*\{/)) {
        stream.backUp(1);
        state.expectMacroBody = true;
        return "variable-2";
      } else {
        return "error";
      }

    case "}":
      if (state.nesting[state.nesting.length - 1] === "}") {
        state.nesting.pop();
        return "bracket";
      } else {
        return null;
      }

    case "\\":
      if (stream.next()) {
        return "atom";
      } else {
        return "error";
      }

    default:
      stream.match(/^[^$_/@{}\\]*/);
      return null;
  }
}

function mode() {
  return { startState, token };
}

this.editorExtensions = {
  twine: {
    "^2.0.0": {
      codeMirror: { mode },
    },
  },
};
