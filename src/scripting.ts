export function evalJavaScript(js: string): unknown {
  const fn = new Function(`'use strict';${js}`);
  return fn();
}

export function evalExpression(js: string): unknown {
  return evalJavaScript("return " + js);
}

export function evalAssign(place: string, value: unknown) {
  const fn = new Function(`"use strict"; ${place} = arguments[0]`);
  fn(value);
}
