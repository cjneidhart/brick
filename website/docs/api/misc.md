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

## `either`

**TYPE**: `either(Array<T>) -> T`

Picks a random element from the array, and returns it.

**Example**: Picking a random weekday

```brick
@(_weekday = either(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
```
