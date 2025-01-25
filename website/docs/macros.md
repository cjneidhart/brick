# Macros

This is a list of built-in macros.

## Fundamental

### `@()`, the unnamed macro {#unnamed}

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

### `@print()` and `@-()` {#print}

`@print` can be used to insert strings into the rendered markup.
If you just need to print the value of a variable, you can simply write that variable in markup.
But for situations where you need to alter the variable slightly before printing, you can use `@print`.

`@-` is an alias of `@print`.

```brick
You need an additional @print(500 - $money) gold to afford this sword.
```

### `@render()` and `@=()` {#render}

`@render` is the supercharged version of `@print`.
While `@print` emits `text` as-is, `@render` actually renders `text` as Brick markup.
This means the string can contain HTML elements or additional macros and they will be processed appropriately.

`@=` is an alias of `@render`.

:::warning
Using `@render` hurts Brick's ability to generate helpful error messages when something goes wrong.
When possible, use a custom macro or `@include` to re-use content.
:::

```brick
// Contrived example: Use string interpolation to set a custom attribute key on a <span>
@render(`<span ${$key}="someValue">This is a span</span>`)
```

### `@include()`

This macro can be used to embed one passage within another.
Simply pass in the name of the passage you want to include.

### Example

Include the contents of the passage "Dark Alley" in the current passage.

```brick
@include("Dark Alley")
```

## Control Flow

### `@if()`, `@elseif()`, and `@else` {#if-elseif-else}

These macros are the most basic tool for conditional logic.
Their structure must be, in order:

- one `@if` macro
- any number of `@elseif` macros
- an optional `@else` macro

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

### `@while()`

Like the JavaScript keyword, `@while` renders its body repeatedly _while_ its condition is true.

```brick
@(_rocks = 10)
// This while loop will display its contents 10 times
@while (_rocks > 0) {
  You spend 5 minutes moving rocks off of the path.
  @(_rocks -= 1)
}
```

### `@for()`

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
      @continue
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
// This is a simplified example of each character in a party taking turns to
// attack an enemy. We use @break to end the loop once the enemy is defeated.
@for (_character of $partyMembers) {
  @($enemyHP -= _character.attack)
  _character.name hit the enemy for _character.attack damage!
  @if ($enemyHP <= 0) {
    @break
  }
}
```

### `@switch()`

`@switch` can be used to conveniently handle situations where a variable could be one of many possible values.
Within a `@switch` macro, multiple `@case` macros should be used to declare possible blocks of markup to render.
The first `@case` macro that has an argument matching the initial argument to `@switch` will be rendered.
An optional `@default` macro at the end will be rendered if none of the `@case`s matched.

```brick
@switch ($houseShape) {
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

## Input

### `@checkBox()`

`@checkBox` creates a basic checkbox which the user can toggle between `true` and `false`.

```brick
@checkBox($coat, "Put your coat on before leaving")
```

### `@textBox()`

`@textBox` creates a single-line text field the user can enter text in.

```brick
@textBox($name, "Enter your name")
```

## Other

### `@redoable`

Sometimes, you need to re-render part of a passage, without re-rendering the entire passage.
In those situations, the macro `@redoable` can designate a section of markup for re-rendering.
After the passage is rendered, you can call `Engine.redo()` to re-render all markup contained in `@redoable` macros.

```brick
// Display the player's money (purchase buttons can call `Engine.redo()` to update this)
You have @redoable { $money } credits in your wallet.

// Example purchase link (very basic, test this carefully before using it)
@button("Buy a soda", () => {
  $inventory.push("soda");
  $money -= 10;
  Engine.redo();
})
```

### `@later()`

`@later` renders its content after a delay.
This is useful if you want content to appear after a delay, or if you want to manipulate the passage after it has been rendered.
`@later` takes one optional argument: the number of milliseconds to wait.
By default, this is `40`, which is generally long enough for the browser to finish drawing the passage.
Note that even if you pass a delay of `0`, `@later` will still be rendered _after_ the rest of the passage.

**Accessibility Note**: Everyone reads at different speeds.
Do not use `@later` to hide content after a delay.

<!-- TODO add note about letting users skip delays -->

```brick
// Simple example: render some content after a delay.
// All of these sentences will appear in the same paragraph.
You freeze in place.
@later(1000) {
  Slowly, you turn around.
  // This @later's timer won't start until after the outer @later has rendered
  @later(1000) {
    The hollow eyes of a skeleton stare straight back at you.
  }
}

// More complicated example: DOM manipulation
// TODO
```

### `@punt()`

Sometimes, you want to pass data from one passage to another.
But, that data is only meaningful during the brief transition between passages.
You could use a story variable to hold that data,
but then you have to double-check you're not already using that variable,
and remember to `delete` it afterwards.

Alternatively, you can _punt_ a temporary variable.
Punting a temporary variable prevents it from being forgotten the next time you change passages. If necessary, the new passage can then punt it again, so a third passage can receive it. However, it might be easier to just use story variables at that point.

It doesn't matter when in the passage you call `@punt`. You can punt multiple temporary variables at once by passing them all as arguments to `@punt`. Calling `@punt` twice or more on the same temporary variable in the same passage has no effect.

```brick
:: Passage 1
@(_x = 5)
@punt(_x)

[[Passage 2]]

:: Passage 2
// _x will be 5
// It's a good idea to double-check any punted variables in the newer passage
Temp variable \_x is now: _x

// After clicking this link, _x will be forgotten.
[[Passage 3]]
```

### `@link()`

**Syntax**: `@link(label, [passageName], [onClick])`

This creates a hyperlink the user can interact with.
When the link is clicked, two things will happen:

1. If `onClick` was given, it will be called.
   It will receive one argument, the
   [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
   that the button just received.
2. If `destinationPassage` was given, it must be a passage name.
   Brick will navigate to that passage, creating a new moment in history.

```brick
// These are both equivalent
[[Visit the Pond->Pond]]
@link("Visit the Pond", "Pond")

// This link will subtract 5 from $money, then call Engine.redo()
@link("Buy a coffee", () => {
  $money -= 5;
  Engine.redo();
})

// This link will subtract 5 from $money, then go to the "Street" passage
@link("Buy a coffee and leave", "Street", () => {
  $money -= 5;
})
```

### `@macro()`

This is a slightly simpler alternative to `createMacro`.
The first argument is the location to assign the new macro to.
This can be any JS expression that's valid as the left-hand side of an assignment,
but it will usually be a constant such as `@myNewMacro`.

All additional args are the names of the macro's parameters,
which must be temporary variables (prefixed with `_`).

The new macro will not be able to receive a body; for that, use `@parentMacro`.
When invoked, the new macro will assign its arguments to the names given to `@macro`,
then render the body given to `@macro`.

#### Example

Here, we create a new macro `@speechBubble`.
This macro takes a speaker's name and their speech and
wraps it in a `<div>` that can be styled with CSS.

```brick
// In StoryInit
@macro(@speechBubble, _speaker, _text) {
  <div class="speech-bubble">
    <strong>_speaker</strong>
    <p>_text</p>
  </div>
}

// In a passage
@speechBubble("Guard", "Come with me. The King requests your presence.")

// Result
<div class="speech-bubble">
  <strong>Guard</strong>
  <p>Come with me. The King requests your presence.</p>
</div>
```
