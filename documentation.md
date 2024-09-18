# Brick - a modern Story Format

Brick is a new story format for Twine and Tweego stories.
It aims to be highly extensible, but also fully featured out of the box.

## Markup

### Line Breaks

In Brick, single line breaks are turned into space characters.
To insert a line break into the output, use two line breaks.

### Comments

Comments work like in JavaScript - you can use either `//` for single-line comments,
or `/* ... */` for multi-line "block" comments.
Block comments cannot be nested.

#### Example

```brick
This is plain text that will be printed. // This is a comment

Here's some more text. /* This is another comment
That comment is continuing here. */ This text will be printed as well.
```

The above markup is equivalent to:

```brick
This is plain text that will be printed.

Here's some mroe text. This text will be printed as well.
```

### Naked Variables

Story and temporary variables can be included in markup without needing the `@print` macro.

```brick
@($appleCount = 5)
You have $appleCount apples in your inventory.
```

### Macros

Macros are invoked with the `@` character.
One of the most important macros is `@(`, the unnamed macro.
This macro will silently execute any arguments it receives.
It is useful for assigning values to variables.

```brick
@($name = "Magrat") // sets the story variable "$name" to "Magrat"
```

Some macros also have bodies, denoted with `{` and `}`.
In between these brackets is more markup, although exactly how it is rendered depends on the macro.
The `@if` macro only renders its body if its condition is true:

```brick
// Displays a message if $money is 0
@if($money === 0) {
  Your wallet is totally empty!
}
```

Macro arguments are JavaScript, so you can use any operator or call any function you like:

```brick
// Displays a message if $money is odd
@if ($money % 2 === 1) {
  Surely, you can spare a dollar for this beggar?
}
```

### HTML

You can also include HTML elements in markup.

```brick
// This uses <code> to display text in a monospace font.
<code>I'm sorry Dave, I'm afraid I can't do that<code>, said HAL.
```

## Macros

This is a list of built-in macros.

### `@(`, the unnamed macro

This macro can be used to silently execute JavaScript.
It is mostly useful for setting story/temporary variables, or for calling other functions with side effects.

```brick
// Set the story variable $name to "Brutha"
@($name = "Brutha")

// Remove the element with id "garbage" from the document
@(document.getElementById("garbage").remove())
```

Unlike other macros, the unnamed macro can execute multiple statements:

```brick
// Set the story variables $money to "100", and $debt to "20"
@(
  $money = 100;
  $debt = 20;
)
```

### `@if`, `@elseif`, and `@else`

These macros are the most basic tool for conditional logic.
Their structure must be, in order:

- one `@if` macro
- any number of `@elseif` macros
- zero or one `@else` macros

Each `@if` and `@elseif` will have its condition tested, in order.
The first true condition will have its body displayed.
If none of the conditions are true, and an `@else` macro is present, its body will be displayed.

```brick
@if ($strength >= 10) {
  You take a deep breath.
  With a surge of energy, you push the boulder aside.
  Behind it, you find a cave tunnel, untouched for many years.
} @else {
  Try as you might, the boulder does not budge.
  You'll have to find another way to enter the cave system.
}
```

### `@while`

Like the JavaScript keyword, `@while` renders its body repeatedly _while_ its condition is true.

```brick
@(_rocks = 10)
// This while loop will display its contents 10 times
@while (_rocks > 0) {
  You spend 5 minutes moving rocks off of the path.
  @(_rocks -= 1)
}
```

### `@for`

`@for` can be used to efficiently loop over the contents of a _collection_, usually an array.
`@for` is similar to JavaScript's
[`for...of` statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of),
except that you must use a Brick temporary variable (which starts with `_`) instead of declaring a variable with `let` or `const`.

```brick
// List every item in a player's inventory
<ul>
  @for (_item of $inventory) {
    <li>_item</li>
  }
</ul>

// To iterate over ranges of numbers, use the built-in `numberRange` function
@for (_number of numberRange(5)) {
  _number,
}
// Output: "1, 2, 3, 4,"
```

### `@continue`

`@continue` can only be used within `@for` and `@while` loops.
It stops the current loop iteration, and _continues_ from the next iteration.

```brick
NPCs you haven't visited today:
<ul>
  @for (_npc of $npcs) {
    @if (_npc.visitedToday) {
      @continue()
    }
    <li>_npc.name</li>
  }
</ul>
```

### `@break`

`@break` can only be used within `@for` and `@while` loops.
It _breaks_ out of the current loop;
no more markup from the current iteration will be rendered,
and all following iterations will be skipped over.

```brick
// TODO: break example
```

### `@switch`

`@switch` can be used to conveniently handle situations where a variable could be one of many possible values
Within a `@switch` macro, multiple `@case` macros should be used to declare possible blocks of markup to render.
The first `@case` macro that has an argument matching the initial argument to `@switch` will be rendered.
An optional `@default` macro at the end will be rendered if none of the `@case`s matched.

```brick
@switch ($playerName) {
  @case("triangle") {
    3 sides is the best for building structures.
  }
  @case("square", "rectangle") {
    4 sides is mathematically the best, if you think about it.
  }
  @case("pentagon", 'hexagon') {
    5 or 6? I don't know, that's a lot of sides...
  }
  @default {
    Huh, I haven't heard of that shape before.
  }
}
```

### `@do`

_Warning: the `@do` macro is unrelated to JavaScript's `do...while` statement_

Sometimes, you need to re-render part of a passage, without re-rendering the entire passage.
In those situations, the macro `@do` can be used to mark a section of markup for re-rendering.
After the passage is rendered, you can call `Brick.redo()` to re-render all markup contained in `@do` macros.

```brick
// Display the player's money (purchase buttons can call `Brick.redo()` to update this)
You have @do { $money } credits in your wallet.

// Example purchase link (very basic, test this carefully before using it)
@button("Buy a soda", () => {
  $inventory.push("soda");
  $money -= 10;
  Brick.redo();
})
```
