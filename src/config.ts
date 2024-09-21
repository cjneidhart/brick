const config: { preProcessText: undefined | Function } = {
  preProcessText: undefined,
};

function throwTypeError(location: string, expected: string, got: unknown): never {
  throw new TypeError(`${location}: expected ${expected}, got ${typeof got}`);
}

export default {
  get preProcessText(): Function | undefined {
    return config.preProcessText;
  },

  set preProcessText(func: unknown) {
    if (typeof func !== "undefined" && typeof func !== "function") {
      throwTypeError("Config.preProcessText", "function or undefined", func);
    }
    config.preProcessText = func;
  },
};
