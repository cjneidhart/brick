# Passages

The `passages` object provides methods used to query your story's passages.

Whenever a method returns multiple passages, they are sorted by name according to Unicode order.

See the [`Passage` class] for more information on what a `Passage` object is.

[`Passage` class]: ./types#passage

## Functions

### `filter`

Given a predicate function, `filter` returns all passages for which the predicate returns truthy.

#### Signature

```ts
function filter(predicate: (Passage) => boolean): Passage[];
```

#### Example

```js
import { passages } from "brick";
let woodsOrLakePassages = passages.filter((passage) => {
  return passage.tags.includes("woods") || passage.tags.includes("lake");
});
```

### `find`

Given a predicate function, `find` returns a passage for which the predicate returns truthy.

#### Signature

```ts
function find(predicate: (Passage) => boolean): Passage | undefined;
```

### `get`

Returns the passage with the given name, or `undefined` if it does not exist.

#### Signature

```ts
function get(name: string): Passage | undefined;
```

#### Example

```js
const { passages } = Brick;
let alley = passages.get("A Dark Alley");
```

### `withTag`

Given a tag name, returns all passages with the given tag.
Tag names are case-sensitive.

#### Signature

```ts
function withTag(tag: string): Passage[]
```

#### Example

```js
const { passages } = Brick;
let woodsPassages = passages.withTag("woods");
```
