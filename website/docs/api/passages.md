# Passages

The `passages` object provides methods used to query your story's passages.

Whenever a method returns multiple passages, they are sorted by name according to Unicode order.

See the [`Passage` class] for more information on what a `Passage` object is.

[`Passage` class]: ./types#passage

## `filter`

**TYPE**: `(Passage -> boolean) -> Passage[]`

Given a predicate function, `filter` returns all passages for which the predicate returns truthy.

## `find`

**TYPE**: `(Passage -> boolean) -> Passage | undefined`

Given a predicate function, `find` returns a passage for which the predicate returns truthy.

## `get`

**TYPE**: `string -> Passage | undefined`

Returns the passage with the given name, or `undefined` if it does not exist.

## `withTag`

**TYPE**: `string -> Passage[]`

Given a tag name, returns all passages with the given tag.
Tag names are case-sensitive.
