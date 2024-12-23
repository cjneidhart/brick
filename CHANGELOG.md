# Changelog

This project follows semantic versioning.
All changes are backwards-incompatible since it has not reached `1.0.0`.

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

[0.3.0]: https://github.com/cjneidhart/brick/releases/tag/v0.3.0
[0.2.2]: https://github.com/cjneidhart/brick/releases/tag/v0.2.2
[0.2.1]: https://github.com/cjneidhart/brick/releases/tag/v0.2.1
[0.2.0]: https://github.com/cjneidhart/brick/releases/tag/v0.2.0
