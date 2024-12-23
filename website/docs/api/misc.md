# Miscellaneous Functions

## `clone`

**TYPE**: `clone(value: T) -> T`

`clone` returns a deep copy of a given value.
The value must either be a type known to Brick, or it must have a `clone` method.
Functions and Symbols cannot be cloned.

**Example**: Alterations to an object do not affect its clones, and vice versa

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

## `createMacro`

**TYPE**: `createMacro(func)`

`createMacro` is the most powerful way to create macros.
It returns a macro object, which can be assigned to a property on `constants` and used as a macro.
When the macro is called, it will call `func`. The first argument will be a special `MacroContext` object.
All additional arguments will be the arguments received by the macro.
The macro context has two important properties:

- `contents`: If this is present, it is the AST of the macro's children.
  It can be passed to [`render`](./misc#render) to be converted into HTML.
- `createCallback`: this method receives one argument, a function, and returns a function that when called:
  - unpacks all captured variables into `Engine.temp`
  - calls the wrapped function
  - restores the captured variables from before it was called
  - returns the value returned by the wrapped function

## `either`

**TYPE**: `either(Array<T>) -> T`

Picks a random element from the array, and returns it.

**Example**: Picking a random weekday

```brick
@(_weekday = either(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
```

## `makeElement`

**TYPE**: `makeElement(tagName: string, attributes?: object, ...children: (string | Node)[])`

A short, utility function for creating elements via JavaScript.
When only one argument is given, it behaves identically to `document.createElement`.
The optional second argument is a record of attributes to set on the new element.
Any additional arguments are `append()`'ed to the new element.

**Example**: Create a new anchor element,
with the `href` set to `https://example.com`,
and the text `Example Link`.

```js
let newAnchor = makeElement("a", { href: "https://example.com" }, "Example Link");
```

## `numberRange`

**TYPE**: `numberRange(start = 0, stop: number, step = 1)`

`numberRange`, inspired by Python's `range()` function, lets you iterate over number sequences in `for...of` loops.
It yields each number, starting at `start` (which defaults to `0` if not given), incrementing by `step` (default `1`)
until it reaches or passes `stop`. Notably, it does not yield `stop`.

**Example**: Repeat the phrase "Hello!" five times

```brick
@for(_i of numberRange(5)) { Hello! }
```

## `render`

**TYPE**: `render(target: Element | DocumentFragment, input: AST | Passage, parentContext?: MacroContext)`

`render` is mainly intended to be used within macros.
When `input` is a `Passage`, it will be parsed and converted to an `AST`.
The `AST` will be rendered onto `target`.
Any pre-existing children of `target` will be left alone.

## `renderPassage`

**TYPE**: `renderPassage(target: HTMLElement, passage: string | Passage)`

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
