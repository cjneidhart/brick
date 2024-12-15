# Brick

This is a WIP Story Format for Twine/Tweego.
Its priorities are being easy to use, and highly performant.
Compared to existing formats, Brick draws most of its inspiration from [SugarCube](https://www.motoslave.net/sugarcube/2/),
but with a syntax that resembles JavaScript instead of HTML.

For a full reference of Brick's syntax, macros, and API, consult the [documentation](https://brick-tw.readthedocs.io).

## Building manually

[NodeJS] and [pnpm] are necessary to build this project.
Other package managers, such as `npm`, should work but will not be able to read the lockfile.

First, `cd` into the `brick` directory.
Then, run `pnpm install` (this only needs to be done after initially downloading or updating Brick).
Finally, run `pnpm build`.
This will create a `format.js` file in the directory `storyformats/brick/`.

[NodeJS]: https://nodejs.org
[pnpm]: https://pnpm.io
