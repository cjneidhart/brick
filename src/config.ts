const config: { preRender: undefined | Function } = {
  preRender: undefined,
};

function throwTypeError(location: string, expected: string, got: unknown): never {
  throw new TypeError(`${location}: expected ${expected}, got ${typeof got}`);
}

export default {
  get preRender(): Function | undefined {
    return config.preRender;
  },
  set preRender(func: unknown) {
    switch (typeof func) {
      case "undefined":
      case "function":
        config.preRender = func;
        break;

      default:
        throwTypeError("Config.preRender", "function or undefined", func);
    }
  },
};
