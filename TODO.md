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

## Planned Features

- Automated testing.
- Nicer-looking documentation, potentially using a service like readthedocs.io.
  This ties in with:
- A new-user tutorial. This would start with the very basics, like links between passages, and eventually get to advanced JavaScript features.
- A way for users to add macros via markup, like `<<widget>>` in SugarCube or `(macro: )` in Harlowe.
  I'll probably call it `@macro`.
- A way to add metadata to passages, typically to enable storylets.
  - Should this be enabled by a macro to be parsed at startup, or would that be too expensive?
    It could be faster if such passages had an opt-in tag.
  - Probably, this would let users define properties on a `.meta` field on each passage,
    or maybe it would let them define properties directly on the passage object.
  - Could this also let users define passage-specific CSS within that passage?
    The necessary transform becomes significantly easier if the browser supports CSS nesting.
- A `state` enum for the engine, to track what state it is currently in, and what operations are allowed.
- A redirection system. Similar to `Config.navigation.override` in SugarCube or `(redirect: )` in Harlowe.
- An internal PseudoRandom Number Generator, so users can provide a seed and get consistent results.
- Change the parser and/or renderer to automatically produce `<p>` when appropriate.
- Ways for users to query history.
  Other formats expose functionality like `hasVisited()` in SugarCube or the `visits` keyword in Harlowe.
  But this is not as easy in Brick because of IndexedDB;
  only the current moment is loaded from storage, and other moments cannot be obtained synchronously.
  Some potential alternatives are:
  - A `previous` field on each moment, storing the name of the previous passage.
    This is pretty likely, since it has nearly no performance cost.
  - Store a way to query history on each moment.
    This would likely be a map, where each key is a passage name,
    and each value is the number of times that passage has been played and the last turn on which it was played.
    It could also just be an array of every turn's passage name.
    This is potentially expensive;
    even with a map, the total size of a moment is now much bigger.
    If I do this, it will at least have a config flag to opt-out.
- Automated benchmarks.
- Persistent storage, similar to `memorize()` and `recall()` in SugarCube.
- Author-defined settings, which have a nice UI and persist between saves.
- Debug mode.

## Very long-term goal

There's been frequent demand on the Twine Games Discord server for tooling to make Visual Novels.
I'd like to eventually make a format that works well with VNs, although it would potentially require forking Brick because the markup syntax would be different.
