---
toc_max_heading_level: 2
---

# Markup

In Brick, most text you write is rendered on the page as-is.
However, some characters, such as `@`, introduce special behavior.

## Line Breaks

In Brick, single line breaks are turned into space characters.
To insert a line break into the output, use two line breaks.

## Comments

Comments work like in JavaScript - you can use either `//` for single-line comments,
or `/* ... */` for multi-line "block" comments.
Block comments cannot be nested.

### Example

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

## Variables

Story variables, temporary variables, and constants can be included in markup without needing the `@print` macro.

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

## Links (Wiki-style)

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

## Macros

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

## HTML

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

For most attributes, the value will be converted into a string.
But for the event handler attributes, such as `onclick`,
if the expression's value is a function, it will be bound with `addEventListener`.

```brick
@(_handler = () => alert("Surprise!"))
<button ondblclick=(_handler)>Double Click Me!</button>
```
