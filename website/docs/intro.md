# Introduction

Brick is a modern story format for [Twine] and [Tweego].
It is made with a focus on performance and ease-of-use.

[Tweego]: https://motoslave.net/tweego
[Twine]: https://twinery.org


## Fundamental Concepts

A single Brick _story_ is composed of several _passages_.
A passage can be as long or as short as you want.
In Twine, each passage is represented as a separate block on the story map.
In Tweego, each passage is marked by a line starting with `::`.

Passages can be connected to each other by _links_.
A basic link to a passage titled "Lake" looks like `[[Lake]]`.
Links can also be created by the [`@link`] macro.
Additionally, the [`@include`] macro embeds one passage within another.

[`@include`]: ./macros#include
[`@link`]: ./macros#link

To keep track of the game state, you use _story variables_.
Story variables start with a `$` character.
A story can have any number of story variables at any time.
You can do many things with story variables,
but the most basic is using the [unnamed macro] to set variables and the [`@if`] macro to write conditional logic.

[unnamed macro]: ./macros#unnamed
[`@if`]: ./macros#if-elseif-else

Every time the passage changes, Brick creates a new _moment_.
A moment is a snapshot of the game's state.
It has many parts, but the most important are the passage title and the story variables.
Players can use the forward and backward buttons in the sidebar to navigate between moments.

A sequence of connected moments forms a _history_.
Players can use the saves menu to create, delete, and move between histories.
There is always one "active" history.
This history will be restored when the player returns to the page after reloading or closing the tab.
