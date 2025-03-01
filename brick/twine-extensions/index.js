import { mode } from "brick-codemirror";

const builtinMacroDefaults = {
  unnamed: `@($STORY_VARIABLE = SOME_VALUE)`,
  append: `@append("SELECTOR") { BODY }`,
  break: `@break`,
  checkBox: `@checkBox($VAR_NAME, "LABEL")`,
  continue: `@continue`,
  if: `@if(CONDITION) { BODY } @else if (SOME_OTHER_CONDITION) { BODY_2 } @else { BODY_3 }`,
  include: `@("PASSAGE_NAME")`,
  later: `@later(DELAY) { BODY }`,
  link: `@link("LABEL", "PASSAGE_NAME")`,
  macro: `@macro(@MACRO_NAME, _ARG1, _ARG2) { BODY }`,
  for: `@for(_TEMP_VARIABLE of $SOME_ARRAY)`,
  prepend: `@prepend("SELECTOR") { BODY }`,
  print: `@print($SOME_VALUE)`,
  punt: `@punt(_VAR_NAME)`,
  redoable: `@redoable { BODY }`,
  render: `@render("SOME_MARKUP")`,
  replace: `@replace("SELECTOR") { BODY }`,
  switch: `@switch(EXPRESSION) {\n@case(VALUE1) { BODY1 }\n@case(VALUE2) { BODY 2 }\n@default { DEFAULT_BODY }\n}`,
  textBox: `@textBox($VAR_NAME, "LABEL")`,
  while: `@while(CONDITION) { BODY }`,
};

const commands = {};
for (const key in builtinMacroDefaults) {
  commands[`insert_macro_${key}`] = (editor) => {
    editor.getDoc().replaceSelection(builtinMacroDefaults[key]);
  };
}

function toolbar(_editor, _environment) {
  const menu = {
    type: "menu",
    label: "Built-in macros",
    items: [],
  };
  for (const key in builtinMacroDefaults) {
    menu.items.push({
      type: "button",
      label: key,
      command: `insert_macro_${key}`,
    });
  }
  return [menu];
}

export const editorExtensions = {
  twine: {
    "^2.4.0": {
      codeMirror: { commands, mode, toolbar },
    },
  },
};
