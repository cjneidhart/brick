# Brick

This is a WIP Story Format for Twine/Tweego.
Its priorities are being easy to use, and highly performant.
Compared to existing formats, Brick draws most of its inspiration from [SugarCube](https://www.motoslave.net/sugarcube/2/),
but with a syntax that resembles JavaScript instead of HTML.

For a full reference of Brick's syntax, macros, and API, consult the [documentation](https://github.com/cjneidhart/brick/blob/main/documentation.md).

## Example

```brick
// Code within @(...) is executed as JavaScript,
// with the addition of '$' and '_' to denote story and temporary variables.
@($inventory = ["apple", "sword", "cloak"])

// "if", "for", and "while" work like their JavaScript counterparts
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

// Wiki-style links of course
[[Shop]] // This will create a hyperlink to the passage "Shop"

// This will create a hyperlink with the text "Go to Bed",
// that links to the passage "Sleep"
[[Go to Bed->Sleep]]
```

## Usage

### Twine 2

To use this story format in Twine 2, from within Twine click on **Twine** at the top, then **Story Formats**, then **+ Add**.
In the text box, paste in `https://cjneidhart.github.io/brick/v0.2.0/format.js`.
Twine should say "Brick 0.2.0 will be added".
Click the green **+ Add** button to confirm.
"Brick 0.2.0" should be in the list of story formats now.

Next, create a new story.
Then, at the top go to **Story** then **(i) Details** to open a details box in the bottom right.
In the details box, select "Brick 0.2.0" from the dropdown.

Congrats! You're now using Brick.

### Tweego

You can download Brick's `format.js` from the "Releases" page on the right.
Consult [Tweego's documentation](https://www.motoslave.net/tweego/docs/#getting-started-story-formats) on where it looks for story formats.
Make sure your `StoryData` passage has `"format": "Brick"` (case-sensitive) and `"format-version": "0"`.

## Building manually

[NodeJS](https://nodejs.org/en) is necessary to build this project.
First, run `npm install` (this only needs to be done after initially downloading or updating Brick).
Then, run `npm run build`.
This will create a `format.js` file in the directory `storyformats/brick/`.
