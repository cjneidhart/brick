# TODO

This is a loose list of known issues, and planned features.
Eventually I'll switch over to GitHub Issues for tracking all this,
but right now it's easier to just write it all down in one file.

If you find a bug or have a feature you'd like to see, feel free to make an Issue for it.
Even if it's already listed in this file, creating an Issue helps me decide what to prioritize.

## Known Issues

- The JS parser displays unhelpful errors when it finds a sigil-ed variable in an unallowed position.
  Examples: `{ $foo: 4 }`, `{ __proto__: null }`, `$myObject._length = 4`.
- The Twine highlighter does not support RegExp literals.

## Prerequisites for 1.0

- Finish writing automated tests (as of writing this, I'm about 10% done).
- A new-user tutorial.
- A `@parentMacro` macro to compliment `@macro`.
- Alternate newline modes:
  - Markdown-style (default): 2 or more newlines create a paragraph break
  - SC/Harlowe style: each newline becomes a `<br>`
  - verbatim: newlines are passed through (and thus ignored by HTML's whitespace treatment)
- Add a `previous` field to `Moment`
- Add an opt-in way to track history synchronously.
- A "Hooks" system for authors to interrupt and/or alter default Brick behavior.
- Overhaul default UI if I'm going to.
- A redirection system, similar to `Config.navigation.override` in SugarCube or `(redirect: )` in Harlowe.

# After 1.0

- `for...in` loops and C-style `for` loops as macros.
- A way to add metadata to passages, mainly to enable storylets.
- A way to persist data between saves.
- A settings API and UI.
- Debug mode.
- An internal pseudorandom number generator (PRNG).
- A simplified date/time system, so authors don't use `Date` when it's not appropriate.
- `do...while` macro.

## Very long-term goal

There's been frequent demand on the Twine Games Discord server for tooling to make Visual Novels.
I'd like to eventually make a format that works well with VNs, although it would potentially require forking Brick because the markup syntax would be different.
