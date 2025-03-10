# Brick

This is a WIP Story Format for Twine/Tweego.
Its priorities are being easy to use, and highly performant.
Compared to existing formats, Brick draws most of its inspiration from [SugarCube](https://www.motoslave.net/sugarcube/2/),
but with a syntax that resembles JavaScript instead of HTML.

For a full reference of Brick's syntax, macros, and API, consult the [documentation](https://brick-if.readthedocs.io).

## Repository Map

This repository is a workspace, split into three separate packages.
View each package's README for more information.

- [`brick`](./brick):
  The main package, the runtime which is present in every compiled story.
- [`website`](./website):
  Brick's documentation website.
- [`brick-codemirror`](./brick-codemirror):
  A CodeMirror 5 tokenizer for Brick's markup language.
  Both of the other packages depend on this package.
