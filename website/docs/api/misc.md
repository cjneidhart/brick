# Miscellaneous Functions

These functions are available globally in JavaScript expressions and statements

## Functions

### `importPassage`

This function can be used within the Story JavaScript and `module` passages to import modules.
It returns a `Promise` which resolves to that module's exports.
As a special case, the `Brick` global variable is available as a module named `"brick"`.

#### Signature

```ts
function importPassage(moduleName: string): Promise<Record<string, unknown>>;
```

#### Example

Suppose you have the following `module` tagged passage, named `soup`.

```js
:: soup [module]
export function add(x, y) {
  return x + y;
}
```

Then, you can do the following in your Story JavaScript:

```js
const { constants } = Brick;
const { add } = await importPassage("soup");
constants.add = add;
```

Now, the `add` function from the `soup` module is exposed on `constants`,
so you can use it in a passage as `@add`.

```brick
The total is @add(5, 7) dollars.
// The total is 12 dollars.
```

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

### `createGetter`

Define a simple getter on the `constants` object.
Used to define very basic macros that take no arguments and no children.

#### Signature

```ts
function createGetter(name: string, getter: () => unknown);
```

#### Example

Story JS:

```js
const { createGetter, engine } = Brick;
createGetter("fullName", () => {
  const { firstName, lastName } = engine.vars;
  return `${firstName} ${lastName}`;
});
```

In a passage:

```brick
@($firstName = "John")
@($lastName = "Smith")
Your full name is @fullName.
// Result:
Your full name is John Smith.
```

### `createMacro`

`createMacro` is the most powerful way to create macros.
It returns a macro object, which can be assigned to a property on `constants` and used as a macro.
When the macro is called, it will call `func`.
The first argument will be a special [`MacroContext`] object.
All additional arguments will be the arguments received by the macro.

[`MacroContext`]: ./types#macro-context

#### Signature

```ts
function createMacro(macroFunc: (context: MacroContext, ...args: unknown[]) => string | Node): Macro;
```

#### Example

This is a very simplified version of the built-in [`@replace`] macro.

[`@replace`]: ../macros#replace

```js
const { constants, createMacro } = Brick;

constants.replace = createMacro((context, selector) => {
  let element = document.querySelector(selector);
  element.innerHTML = "";
  context.render(element, context.content);
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
@(_randomWeekday = either(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
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

`numberRange`, inspired by Python's `range()` function,
lets you iterate over number sequences in `for...of` loops.
It yields each number, starting at `start` (which defaults to `0` if not given),
incrementing by `step` (default `1`)
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

### `passageName`

Returns the name of the active passage.

#### Signature

```ts
function passageName(): string;
```

#### Example

```brick
// Create a header with the current passage's name
<h1>@print(passageName())</h1>
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
  tempVars: Record<string, unknown>,
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
- `data-tags` is set to the passage's tags, separated by spaces.

If the passage does not exist, an error indicating as such will be rendered onto the element.
If the passage does not exist or any errors occurred while rendering,
`renderPassage` will return `false`.
Else, it returns `true`.

#### Signature

```ts
function renderPassage(
  target: HTMLElement,
  tempVars: Record<string, unknown>,
  passage: string | Passage,
): boolean;
```

### `tags`

Returns an immutable array containing the active passage's tags.

#### Signature

```ts
function tags(): readonly string[];
```

#### Example

```brick
// Display a different message in any passages tagged "woods"
@if (tags().includes("woods")) {
  A few rays of sunlight poke through the thick leaves.
} @else {
  The bright sun shines down, causing you to sweat.
}
```
