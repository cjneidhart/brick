# Custom Types

## Passage

The `Passage` class, mainly returned by methods on the `passages` object, represents a passage in the story.
Passages have the following properties:

<dl>
  <dt>`name`: `string`</dt>
  <dd>The name of the passage</dd>

  <dt>`slug`: `string`</dt>
  <dd>The slugified name of the passage. For example, “The Witch's Cabin” will become `the-witchs-cabin` when slugified. The slug is guaranteed to be a valid CSS identifier.</dd>

  <dt>`tags`: `string[]`</dt>
  <dd>An array containing all of the passage's tags, in alphabetical order.</dd>
</dl>

## Macro Context

The `MacroContext` class, available as the first argument to any macro, is used to pass additional information into the macro.
Macro Contexts have the following properties:

<dl>
  <dt>`name`: `string`</dt>
  <dd>This is the name the macro was called by, including the sigil. Its primary purpose is to enable better error messages; macros should generally behave the same regardless of what name they are called by.</dd>

  <dt>`content`: `AST | undefined`</dt>
  <dd>If this is `undefined`, it means the macro was called without children (without being followed by a `{...}`). If it is not `undefined`, it represents a fragment of a passage. This AST is an opaque type, but it can be safely passed to the [`render`] function.</dd>

  <dt>`parent`: `MacroContext | undefined`</dt>
  <dd>If the macro was the child of another macro, `parent` will be the containing macro's context.</dd>

  <dt>`passageName`: `string`</dt>
  <dd>The name of the passage this macro was invoked in.</dd>

  <dt>`lineNumber`: `string`</dt>
  <dd>The line number this macro's invocation starts on. The first line is number 1.</dd>

  <dt>`createCallback`: `function (f: Function) -> Function`</dt>
  <dd>This is used to create callback functions which will respect any captured variables this macro has access to.</dd>
</dl>

[`render`]: ./misc#render
