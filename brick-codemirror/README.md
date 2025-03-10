# Brick/brick-codemirror

This directory holds a [CodeMirror 5] tokenizer for the Brick markup language.

It is used by the main [`brick`] package to add syntax highlighting to Twine's editor,
and by Brick's own documentation.

This package is not meant to be built or distributed standalone.
Instead, the [`brick`] and [`website`] packages import it during their build processes.

[CodeMirror 5]: https://codemirror.net/5/
[`brick`]: ../brick
[`website`]: ../website
