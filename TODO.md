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
- Add a `previous` field to `Moment`
- Add an opt-in way to track history synchronously.
- A "Hooks" system for authors to interrupt and/or alter default Brick behavior.
- Overhaul default UI if I'm going to.
- A redirection system, similar to `Config.navigation.override` in SugarCube or `(redirect: )` in Harlowe.

## Maybe in 1.0

- `for...in` and C-style for syntax in the `@for` macro.
- Audio library (potentially as an official extension).
- `list` macro to more easily create `<ul>` and `<table>` elements.

## After 1.0

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
