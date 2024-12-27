# Miscellaneous Functions

These functions are available globally in JavaScript expressions and statements

## Functions

### `clone`

`clone` returns a deep copy of a given value.
The value must either be a type known to Brick, or it must have a `clone` method.
Functions and Symbols cannot be cloned.

#### Signature

```ts
function clone<T>(value: T): T;
```

#### Example

```brick
@($original = { value: 10 })
@($clone = clone($original))
@($original.value = 20)

$original.value // 20
$clone.value    // 10

@($clone.value = 5)

$original.value // 20
$clone.value    // 5
```

### `createMacro`

`createMacro` is the most powerful way to create macros.
It returns a macro object, which can be assigned to a property on `constants` and used as a macro.
When the macro is called, it will call `func`. The first argument will be a special [`MacroContext`] object.
All additional arguments will be the arguments received by the macro.

[`MacroContext`]: ./types#macro-context

#### Signature

```ts
function createMacro(macroFunc: (ctx: MacroContext, ...args: unknown[]) => string | Node): Macro;
```

#### Example

```ts
// This is a very simplified version of the built-in "@replace" macro
constants.replace = createMacro((ctx, selector) => {
  let elt = document.querySelector(selector);
  elt.innerHTML = "";
  render(elt, ctx.content, ctx);
  return "";
});
```

### `either`

Picks a random element from an array, and returns it.

#### Signature

```ts
function either<T>(arr: T[]): T;
```

#### Example

```brick
@(_weekday = either(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
```

### `makeElement`

A short, utility function for creating elements via JavaScript.
When only one argument is given, it behaves identically to `document.createElement`.
The optional second argument is a record of attributes to set on the new element.
Any additional arguments become the children of the new element.

#### Signature

```ts
function makeElement(
  tagName: string,
  attributes?: Record<string, string>,
  ...children: (string | Node)[],
);
```

#### Example

```js
let exampleAnchor = makeElement("a", { href: "https://example.com" }, "Example Link");
// Result:
// <a href="https://example.com">Example Link</a>
```

### `numberRange`

`numberRange`, inspired by Python's `range()` function, lets you iterate over number sequences in `for...of` loops.
It yields each number, starting at `start` (which defaults to `0` if not given), incrementing by `step` (default `1`)
until it reaches or passes `stop`. Notably, it does not yield `stop`.

#### Signature

```ts
function numberRange(stop: number): Iterable<number>;
function numberRange(start: number, stop: number, step?: number): Iterable<number>;
```

#### Example

```brick
@for(_i of numberRange(5)) { Hello, player _i! }
```

### `render`

`render` is mainly intended to be used within macros.
When `input` is a `Passage`, it will be parsed and converted to an `AST`.
The `AST` will be rendered onto `target`.
Any pre-existing children of `target` will be left alone.

#### Signature

```ts
function render(
  target: Element | DocumentFragment,
  input: AST | Passage,
  parentContext?: MacroContext,
): boolean;
```

### `renderPassage`

This can be used to render a passage onto an element.
If `passage` is a string, it will be interpreted as the name of a passage.

The target's contents will be cleared before rendering the passage.
`renderPassage` also sets several attributes on the element:

- The element gains a new class, which is the passage's name slugified, prefixed by `psg-`.
- `data-name` is set to the passage's name, not slugified.
- `data-tags` is seto to the passage's tags, separated by spaces.

If the passage does not exist, an error indicating as such will be rendered onto the element.
If the passage does not exist or any errors occurred while rendering, `renderPassage` will return `false`.
Else, it returns `true`.

#### Signature

```ts
function renderPassage(target: HTMLElement, passage: string | Passage): boolean;
```