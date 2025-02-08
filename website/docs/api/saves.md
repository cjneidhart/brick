# Saves

The `saves` object contains functions useful for saving and loading data.

## Functions

### `registerClass`

```ts
function registerClass(class_: Function);
```

By default, Brick can store most types of JavaScript values in its saves,
including all primitives (except symbols), generic objects, Arrays, and Maps.
However, it cannot store instances of unknown classes.
`registerClass` lets you tell Brick how to safely save and load instances of any class you write.

As an example, suppose you have the following class `Point2D`,
and you'd like to store instances of `Point2D` in story variables.

```js
class Point2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  toString() {
    return `Point2D(${this.x}, ${this.y})`;
  }
}
```

To make this class compatible with Brick's save system, we need to define three new methods:
- `clone`:
  An instance method that returns a new instance of this class
- `static serialize`:
  A static method that receives a `Point2D` instance and returns a plain object or array
- `static deserialize`:
  A static method that receives the plain object or array
  from `serialize` and constructs a new `Point2D`

The exact implementations of these methods can vary.
Here is a basic example for `Point2D`:

```js
class Point2D {
  // ...

  clone() {
    return new Point2D(this.x, this.y);
  }

  static serialize(point) {
    return { x: point.x, y: point.y };
  }

  static deserialize(plainObject) {
    return new Point2D(plainObject.x, plainObject.y);
  }
}
```

Now that the class has these three methods, we can call `registerClass`.
It's best to do this in the same place you store the class on the `constants` object.

```js
import { constants, saves } from "brick";

class Point2D {
  // ...
}

saves.registerClass(Point2D);
constants.Point2D = Point2D;
```

With all that complete, we can now store `Point2D` instances in story variables.

```brick
@($playerLocation = new @Point2D(4, 20))
You are $playerLocation.x miles east and $playerLocation.y miles north of your home.
You are $playerLocation.magnitude() miles from home.
```

