---
toc_max_heading_level: 2
---
# Config

The `config` object, available globally,
defines a number of useful settings you can use to customize Brick.

## `historyLength`

**Type** `number` (positive integer)<br />
**Default** `100`

This sets the maximum length of the history.
In effect, this is how many turns back the user can rewind.
This includes the current turn, so the minimum is `1`.

Altering this setting has no effect on performance.
However, raising it too high can cause unnecessary clutter in the player's storage.

## `maxLoopIterations`

**Type** `number` (positive integer)<br />
**Default** `1000`

[`@while`] and [`@for`] include safeguards to prevent infinite loops.
If a loop runs more than this many times,
it will be cancelled and an error message will be displayed.
You can set this to `Infinity` to disable it.

[`@while`]: ../macros#while
[`@for`]: ../macros#for

## `newlineMode`

**Type** `"markdown"`, `"allBreaks"`, or `"noBreaks"`<br />
**Default** `"markdown"`

This controls how newlines are translated by Brick into HTML:

- `"markdown"` (default):
  Text is placed inside `<p>` (paragraph) elements.
  Two or more consecutive newlines indicate a break between paragraphs.
- `"allBreaks"`:
  Every newline becomes a `<br>` (break) element.
  This mode is close to how SugarCube and Harlowe treat newlines.
- `"noBreaks"`:
  All newlines are passed as-is into HTML,
  and thus [HTML's whitespace rules] treat them as spaces.

[HTML's whitespace rules]: https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace

## `preProcessText`

**Type** `undefined` or `function (passage) -> string`<br/>
**Default** `undefined`

This function allows you to alter the text of passages immediately before they are rendered.
It receives one argument, a `Passage` object, and must return a string.
That string will be used in place of the passage's actual contents.

### Example

This example uses a regular expression to convert every variant of "Chris"
(i.e. "CHRIS", "chris", or "cHrIs") to "Chris".

```js
const { config } = Brick;

config.preProcessText = function (passage) {
  return passage.contents.replace(/\bchris\b/ig, "Chris");
};
```

## `stream`

**Type** `boolean`<br/>
**Default** `false`

_Warning: `config.stream` is very experimental._
_A change this large has the potential to introduce a wide variety of bugs,_
_and this feature has not been thoroughly tested._

This setting enables "Streaming" mode, also called "Stretch Text" or "Endless Page".
Instead of new passages replacing the current passage,
new passages are added to the screen below the old passages.
Any interactive elements on old passages are disabled.
