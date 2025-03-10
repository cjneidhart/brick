# Brick Classes

## Passage

The `Passage` class, mainly returned by methods on the `passages` object, represents a passage in the story.
Passages are immutable.

```ts
class Passage {
  /** The name of the passage */
  name: string;
  /** The name, slugified */
  slug: string;
  /** The passage's tags, in alphabetical order */
  tags: string[];
  /** The passage's body */
  content: string;
}
```

## Macro Context

The `MacroContext` class, available as the first argument to any macro, is used to pass additional information into the macro.

```ts
class MacroContext {
  /** The name the macro was invoked with, including the sigil */
  name: string;
  /** The AST of the children passed to the macro */
  content?: AST;
  /** The parent's context, if this macro has a parent */
  parent?: MacroContext;
  /** The name of the passage containing this invocation */
  passageName: string;
  /** The line number of this invocation (The first line is 1) */
  lineNumber: number;
  /** The scope of temporary variables this macro was called in */
  tempVars: Record<string, unknown>;
  /** The macro's output */
  output: DocumentFragment;

  /** Create a new scope for temporary variables that inherits from this macro's scope */
  createTempVariableScope(): Record<string, unknown>;

  /** Render an AST, using a newly created variable scope */
  render(target: Element | DocumentFragment, input: AST): boolean;
}
```

If present, the `content` property is an opaque type, called an AST.
It can be safely passed to `render`.

The `name` property is present to provide better error messages.
Macros should generally exhibit the same behavior regardless of the name used to invoke them.
