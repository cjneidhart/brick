# Changelog

This project follows semantic versioning.
Since it has not yet reached `1.0.0`, any version may contain breaking changes.

## Unreleased

### Added

- `config.newlineMode` allows users to change how newlines are translated into HTML:
  - `markdown` (default): Text is placed inside `<p>` elements.
    Two or more consecutive newlines separates paragraphs.
  - `allBreaks`: All newlines are converted into `<br>` elements.
  - `noBreaks`: Newlines are passed straight to HTML, which treats them as spaces.
- `*` and `**` can be used to create `<em>` and `<strong>` respectively, like in Markdown.
- `passages.getOrThrow`, to generate a helpful error message when a passage can't be found.

### Changed

- Wiki-style links cannot contain newlines.
- A `/` character is not allowed after a `}` token unless it starts a comment.
  This is because whether the `/` starts a RegExp literal or is a division operator
  depends on whether the `}` closed an object initializer or a block statement,
  which is currently outside the parser's capabilities.
  To avoid this ambiguity, either wrap the object initializer in parentheses
  or place a semicolon after the block statement.
- Macros created by `@macro` now remove leading and trailing whitespace from their output.

### Fixed

- RegExp literals cannot contain newlines.

## [0.4.1] - 2025-02-13

### Added

- The `@macro` macro.
- The `module` tag.
  Passages tagged `module` are interpreted as JavaScript modules.
  They must be imported from the Story JavaScript or another module, or they will not be executed.
- The `importPassage` function.
  Given a module passage name, this returns a `Promise` that resolves with the module's exports.
- The `@link` macro can now receive children.
  This is mainly intended to work with the DOM macros, like `@replace`.

### Changed

- Story JavaScript is now run as a module.
  This means you can now use `await` at the top-level and it will work as expected.
  You can also use `import` statements to import values from `module` passages,
  or from `brick` itself.
- `Engine` and `Dialog` have been renamed to `engine` and `dialog`.

### Fixed

- JavaScript strings cannot contain unescaped newlines (U+0D CARRIAGE RETURN or U+0A LINE FEED).

### Removed

- Story JavaScript no longer has direct access to properties of the global `Brick` variable;
  they must be accessed through the `Brick` global like
  `Brick.engine` or `const { engine } = Brick;`.
  JavaScript run from within a passage still has direct access to these values.

## [0.4.0] - 2025-01-23

### Added

- The `createGetter`, `passageName`, and `tags` functions.
- The `passages` object, with four methods:
  - `filter`
  - `find`
  - `get`
  - `withTag`
- Passages can now contain `<style>` elements.
- Boxed booleans, numbers, and strings can now be imported and exported properly
  (they could already be saved to the browser's storage).
  A warning will be emitted when these types are saved or passed to `clone`.

### Changed

- Temporary variables are now lexically scoped.
  New scopes are created with each `{ }` pair.
- Parse errors are now "loud";
  encountering a parse error causes Brick to not render anything except the error message.
- Leading and trailing whitespace in a wiki-style link is now trimmed,
  to match the behavior of passage initialization.
  Whitespace around the link/text separator (`|`, `->`, or `<-`) is also trimmed.
- Passage names starting with `Story` are banned, like the documentation says.
- Passage tags starting with `brick` are banned.

### Fixed

- Errors that occur while evaluating a macro's arguments are properly caught and rendered,
  instead of being handled by an `alert()`.

### Removed

- The `capturedVars` and `createCallback` properties of `MacroContext` have been removed.

## [0.3.1] - 2024-12-23

Nothing changed here, I just needed a new version to update the documentation.

## [0.3.0] - 2024-12-23

### Changed

- Added a third type of variable, constants.
  They can be accessed by prefixing an identifier with `@`,
  which is transpiled to `constants.NAME`.
  Constants can only be created or deleted during story startup.
- Macros no longer live in a special registry.
  Now, macros are just methods of the `constants` global value.

## [0.2.2] - 2024-12-15

### Added

- Saves can now be imported and exported as JSON files.
- Trying to read an unset story or temporary variable triggers a "Did you mean...?" warning in the console.
- Functions can be used as dynamic attributes for event listener attributes such as `onclick`.
- `StoryInterface` special passage.
- `stringify` utility function.
- `historyLength` configuration option.

## [0.2.1] - 2024-11-27

### Added

- The `@later` macro for performing operations after a delay.
- The `@append`, `@prepend`, and `@replace` macros for DOM manipulation.
- The `@punt` macro, to preserve a temporary variable between passages.
- The utility functions `either` and `randomInt`.

### Fixed

- Fix a bug in Twine highlighter involving the JavaScript dot operator.

## [0.2.0] - 2024-11-22

Initial release.

### Added

- A full markup parser and renderer
- A save system backed by IndexedDB, with an associated UI menu
- Story and temporary variables that are tracked per-moment
- Captured variables
- The following macros:
  - unnamed macro
  - `@break`
  - `@checkBox`
  - `@continue`
  - `@for`
  - `@if`, `@elseif`, and `@else`
  - `@include`
  - `@link`
  - `@linkReplace`
  - `@print` and `@-`
  - `@redoable`
  - `@render` and `@=`
  - `@switch`, `@case`, and `@default`
  - `@textBox`
  - `@while`

[0.4.1]: https://github.com/cjneidhart/brick/releases/tag/v0.4.1
[0.4.0]: https://github.com/cjneidhart/brick/releases/tag/v0.4.0
[0.3.1]: https://github.com/cjneidhart/brick/releases/tag/v0.3.1
[0.3.0]: https://github.com/cjneidhart/brick/releases/tag/v0.3.0
[0.2.2]: https://github.com/cjneidhart/brick/releases/tag/v0.2.2
[0.2.1]: https://github.com/cjneidhart/brick/releases/tag/v0.2.1
[0.2.0]: https://github.com/cjneidhart/brick/releases/tag/v0.2.0
