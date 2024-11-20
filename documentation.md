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

Here's some more text. This text will be printed as well.
```

### Naked Variables

Story and temporary variables can be included in markup without needing the `@print` macro.

```brick
@($appleCount = 5)
You have $appleCount apples in your inventory.
```

You can also access properties of naked variables:

```brick
@(_weapons = ["sword", "axe"])
Your weapons are a _weapons[0] and a _weapons[1].

@($player = { strength: 15 })
Your Strength is $player.strength.
```

### Links (Wiki-style)

Links to other passages can be created using `[[Double Brackets]]`.
You can use an "arrow" (either `->` or `<-`) to give the link a different text.
For historical reasons, you can also use `|` as a separator, which is the same as `->`

```brick
// Link to the passage "Home"
[[Home]]

// Create a link that reads "Go to the Pond".
// When clicked, the link will navigate to the passage "Pond".
[[Go to the Pond->Pond]]
[[Go to the Pond|Pond]]
[[Pond<-Go to the Pond]]
```

Note that within Wiki-style links, you cannot escape any characters or use any other markup.
For that, you'll have to use the `@link` macro.

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
<code>I'm sorry Dave, I'm afraid I can't do that<code>,
said <abbr title="Heuristically Programmed Algorithmic Computer">HAL</abbr>.
```

In addition to normal HTML, Brick adds a shorthand for setting an element's `id` or `class` attributes.

| Shorthand                      | Same as                                     |
| ------------------------------ | ------------------------------------------- |
| `<span#foo></span>`            | `<span id="foo"></span>`                    |
| `<span.blast></span>`          | `<span class="blast"></span>`               |
| `<span#foo.blast.bang></span>` | `<span id="foo" class="blast bang"></span>` |

When using this short syntax, the id and class must consist of only ASCII letters and numbers, hyphens, and underscores.

You can include JavaScript expressions as HTML attributes by using parentheses instead of quotes:

```brick
// Create a <span> with the title attribute "Surprise!!!"
@(_title = "Surprise")
<span title=(_title + "!!!")>Hover over me for a surprise.</span>
```

## Macros

This is a list of built-in macros.

### `@(...statements)`, the unnamed macro

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

### `@print(text)` and `@-(text)`

`@print` can be used to insert strings into the rendered markup.
If you just need to print the value of a variable, you can simply write that variable in markup.
But for situations where you need to alter the variable slightly before printing, you can use `@print`.

`@-` is an alias of `@print`.

```brick
You need an additional @print(500 - $money) gold to afford this sword.
```

### `@render(text)` and `@=(text)`

`@render` is the supercharged version of `@print`.
While `@print` emits `text` as-is, `@render` actually renders `text` as Brick markup.
This means the string can contain HTML elements or additional macros and they will be processed appropriately.

`@=` is an alias of `@render`.

```brick
// In your story JS
C.red = function (text) {
  return '<span class="red">' + text + '</span>';
}

// In a passage
You encounter a scary @render(C.red("ogre")).
// Renders as:
You encounter a scary <span class="red">ogre</span>.
```

### `@if(condition)`, `@elseif(condition)`, and `@else`

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

### `@while(condition)`

Like the JavaScript keyword, `@while` renders its body repeatedly _while_ its condition is true.

```brick
@(_rocks = 10)
// This while loop will display its contents 10 times
@while (_rocks > 0) {
  You spend 5 minutes moving rocks off of the path.
  @(_rocks -= 1)
}
```

### `@for(variable of collection)`

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

### `@continue()`

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

### `@break()`

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
    @break()
  }
}
```

### `@switch(value)`

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

### `@checkBox(variable, label)`

`@checkBox` creates a basic checkbox which the user can toggle between `true` and `false`.

```brick
@checkBox($coat, "Put your coat on before leaving")
```

### `@textBox(variable, label)`

`@textBox` creates a single-line text field the user can enter text in.

```brick
@textBox($name, "Enter your name")
```

## Config

Some features of Brick can be customized via the `Config` object

### `Config.maxLoopIterations`: `number` (default: `1000`)

`@while` and `@for` include safeguards to prevent infinite loops.
If a loop runs more than this many times, it will be cancelled and an error message will be displayed.
You can set this to `Infinity` to disable it.

### `Config.preProcessText`: `undefined` or `function (passage) -> string`

This function allows you to alter the text of passages immediately before they are rendered.
It receives one argument, a `Passage` object, and must return a string.
That string will be used in place of the passage's actual contents.

```brick
// This example will convert every capitalization variant of "chris" to "Chris"
Config.preProcessText = function (passage) {
  return passage.contents.replace(/\bchris\b/ig, "Chris");
};
```

### `Config.stream`: `boolean` (default: `false`)

_Warning: `Config.stream` is very experimental. A change this large has the potential to introduce a wide variety of bugs, and this feature has not been thoroughly tested._

This setting enables "Streaming" mode, also called "Stretch Text" or "Endless Page".
Instead of new passages replacing the current passage, new passages are added to the screen below the old passages.
Any interactive elements on old passages are disabled.
