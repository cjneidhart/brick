# Special Names

Brick has various passage names and tag names that invoke special behavior.
They are listed below.

## Passage Names

Any passage name starting with "Story" not listed here will cause an error.
These names are considered reserved by Brick.

### Start

This is the default passage that Brick will start the story from.
Both Twine and Tweego have ways to choose a different starting passage,
and those methods take precedence over this passage.

### StoryData

_This passage is hidden when using Twine._
_To change a story's format in Twine, select "Story" -> "Details" at the top._

This passage must be a JSON object.
A full description of its properties is provided by the [IF Tech Foundation].

[IF Tech Foundation]: https://github.com/iftechfoundation/twine-specs/blob/74b3d895651a29aa47d0ce9244eddf3ba4478058/twee-3-specification.md#storydata

Here's a basic `StoryData`.
The IFID has been omitted; both Tweego and Twine can generate an IFID for you.

```json
{
  "ifid": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  "format": "Brick",
  "format-version": "0",
  "start": "Introduction"
}
```

### StoryFooter

If present, this passage will be rendered after the active passage.

### StoryHeader

If present, this passage will be rendered before the active passage.
Because it is rendered first, you may wish to use the [`@later`] macro
to render it after the active passage chronologically
(positionally, it will still be placed above the active passage).

[`@later`]: ./macros#later

### StoryInit

This passage is rendered silently during the startup sequence.
If an active history is not found, any story variables
created here will carry into the Start passage.
As such, it is recommended you initialize most of the
story variables you plan to use in this passage.

### StoryInterface

This passage can be used to completely override Brick's default layout.
Its contents are considered plain HTML.
It must contain an element with the ID `brick-main`.
This element will be where Brick renders the active passage.

### StoryTitle

_This passage is hidden when using Twine._
_To change a story's title in Twine, click "Story" -> "Rename" at the top._

This passage contains the title of the story.
It must not be empty.
Any markup in this passage will be ignored and considered plain text.

## Tags

For future compatibility, tags starting with `brick` are reserved.

### `macro`

This tag registers the passage as a macro.
The passage's name must be a valid macro name;
it must start with a letter and contain only letters, numbers, and underscores.

For a passage named `myMacro`, using it as `@myMacro`
is effectively the same as using `@include("myMacro")`.
The only difference is the slightly shorter syntax.

For now, there is no way for `macro`-tagged passages to receive arguments or children.
This may change in the future.

### `module`

This tag marks the passage as a JavaScript module.
JavaScript modules can `export` values;
these values can then be accessed through `import` statements and the [`importPassage`] function.

[`importPassage`]: ./api/misc#importpassage

To improve syntax highlighting in Twine, a module's body may be surrounded by `@(` and `)`.
These characters will be removed by Brick.

Because modules are considered code, not markup,
they cannot be linked to and cannot be retrieved by functions like
[`passages.get`](./api/passages.md#get).

## Story Variables

Brick reserves any story variables beginning with `-brick`.
Because of the leading hyphen, these variables are not accessible with the `$variable` syntax,
so you generally do not have to worry about them.
