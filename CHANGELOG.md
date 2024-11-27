# Changelog

This project follows semantic versioning.
All changes are backwards-incompatible since it has not reached `1.0.0`.

## Unreleased

### Added

- The `@later` macro for performing operations after a delay.
- The `@append`, `@prepend`, and `@replace` macros for DOM manipulation.
- The utility functions `either` and `randomInt`.

### Fixed

- Fix bug in Twine highlighter involving the JavaScript dot operator.

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

[0.2.0]: https://github.com/cjneidhart/brick/releases/tag/v0.2.0
