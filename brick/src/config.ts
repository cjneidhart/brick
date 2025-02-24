/**
 * @module config
 *
 * This defines the global `config` object, which lets authors customize Brick's
 * behavior.
 */

/** How to handle newlines */
export type NewlineMode = "markdown" | "allBreaks" | "noBreaks";

const config: {
  historyLength: number;
  maxLoopIterations: number;
  newlineMode: NewlineMode;
  preProcessText?: Function;
  stream: boolean;
} = {
  historyLength: 100,
  maxLoopIterations: 1000,
  newlineMode: "markdown",
  preProcessText: undefined,
  stream: false,
};

function throwTypeError(location: string, expected: string, got: unknown): never {
  throw new TypeError(`${location}: expected ${expected}, got ${typeof got}`);
}

export default {
  get historyLength(): number {
    return config.historyLength;
  },

  set historyLength(value: unknown) {
    if (typeof value !== "number" || value <= 0 || value % 1 !== 0) {
      throw new TypeError("config.historyLength must be a positive integer");
    }
    config.historyLength = value;
  },

  get maxLoopIterations(): number {
    return config.maxLoopIterations;
  },

  set maxLoopIterations(value: unknown) {
    if (typeof value !== "number" || value <= 0 || value % 1 !== 0) {
      throw new TypeError("Config.maxLoopIterations must be a positive integer");
    }
    config.maxLoopIterations = value;
  },

  get newlineMode(): NewlineMode {
    return config.newlineMode;
  },

  set newlineMode(value: unknown) {
    if (value === "markdown" || value === "allBreaks" || value === "noBreaks") {
      config.newlineMode = value;
    } else {
      throwTypeError("config.newlineMode", `"markdown", "allBreaks", or "noBreaks"`, value);
    }
  },

  get preProcessText(): Function | undefined {
    return config.preProcessText;
  },

  set preProcessText(func: unknown) {
    if (typeof func !== "undefined" && typeof func !== "function") {
      throwTypeError("Config.preProcessText", "function or undefined", func);
    }
    config.preProcessText = func;
  },

  get stream(): boolean {
    return config.stream;
  },

  set stream(value: unknown) {
    config.stream = !!value;
  },
};
