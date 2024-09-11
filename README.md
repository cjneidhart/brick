# Brick

This is a WIP Story Format for Twine/Tweego. Currently, only Tweego is supported.

This format is intended to be a midpoint between [Snowman](https://videlais.github.io/snowman/) and [SugarCube](https://www.motoslave.net/sugarcube/2/).
Like SugarCube, this format comes with a standard API for save management using local storage, and other high-quality features.
But where SugarCube macros are styled like HTML elements, Brick macros are styled like JavaScript function calls.

## Example
```brick
// Code within @(...) is executed as JavaScript,
// with the addition of '$' and '_' to denote story and temporary variables.
@($inventory = ["apple", "sword", "cloak"])

// "if", "for", "while" and "switch" work like their JavaScript counterparts
@if ($inventory.length === 0) {
  Your inventory is currently empty.
} @else {
  Your inventory contains the following:

  /*
   * Block-style comments are also supported.
   * HTML elements are (generally) rendered directly,
   * although their syntax is stricter than actual HTML.
   */
  <ul id="inventory-list">
    @for(_item of $inventory) {
      // Story and temporary variables can be included "naked" in markup.
      <li>_item</li>
    }
  </ul>
}

// Any JavaScript expression can be a macro argument.
// This macro will find the passage named "inventory comment"
// and print it into the current passage.
@include("Inventory Comment".toLowerCase())
```

## Usage
[NodeJS](https://nodejs.org/en) is necessary to build this project.
First, run `npm install` (this only needs to be done after initially downloading or updating Brick).
Then, run `node build.js`.
This will create a `format.js` file in the directory `storyformats/brick/`.
This `format.js` file can be used with [Tweego](https://www.motoslave.net/tweego/) to build your story.
