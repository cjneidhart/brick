# Brick/Brick

This directory holds the main `brick` runtime:
all the code that is packaged alongside a compiled Twine story.
It also contains extensions to Twine's editor,
except for the syntax highlighter which is in the separate [`brick-codemirror`] directory.

## Building

This project requires [NodeJS] and [pnpm].
Other package managers, such as `npm`, should work but will not be able to read the lockfile.

To build brick, simply run `pnpm install` followed by `pnpm build`.
This will create a `format.js` file in the directory `./storyformats/brick`.

If you would like to debug Brick itself,
set the environment variable `BRICK_DEBUG` to `1` while running `pnpm build`.
This will disable minification of the packaged JavaScript.

[`brick-codemirror`]: ../brick-codemirror
[NodeJS]: https://nodejs.org/
[pnpm]: https://pnpm.io/
