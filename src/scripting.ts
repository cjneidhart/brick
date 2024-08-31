export function evalJavaScript(js: string): unknown {
  const fn = new Function(`'use strict';${js}`);
  return fn();
}

export function evalExpression(js: string): unknown {
  return evalJavaScript("return " + js);
}
