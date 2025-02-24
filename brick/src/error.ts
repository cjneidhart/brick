import { MacroContext } from "./macros";
import { ElementTemplate } from "./parser";

export class BrickError extends Error {
  /** The name of the passage the error occurred in */
  passage: string;
  /** The line number of that passage */
  lineNumber: number;
  /** True if the error has already been displayed */
  displayed: boolean;

  constructor(message: string, passage: string, lineNumber: number) {
    super(`in “${passage}” at line ${lineNumber}: ${message}`);
    this.passage = passage;
    this.lineNumber = lineNumber;
    this.displayed = false;
  }
}

export class MacroError extends BrickError {
  cause: unknown;
  constructor(context: MacroContext, cause: unknown) {
    let message;
    try {
      message = `@${context.name}: ${cause instanceof Error ? cause.message : cause}`;
    } catch {
      message = `@${context.name}: (error could not be converted to string)`;
    }
    super(message, context.passageName, context.lineNumber);
    this.cause = cause;
  }
}

export class DynamicAttributeError extends BrickError {
  cause: unknown;
  constructor(cause: unknown, attribute: string, template: ElementTemplate) {
    let message;
    try {
      message = `while evaluating the attribute "${attribute}": ${cause instanceof Error ? cause.message : cause}`;
    } catch {
      message = `while evaluating the attribute "${attribute}": (error could not be converted to string)`;
    }
    super(message, template.passageName, template.lineNumber);
    this.cause = cause;
  }
}

export class ExprError extends BrickError {
  constructor(cause: unknown, raw: string, passageName: string, lineNumber: number) {
    const message = `while evaluating "${raw}": ${cause}`;
    super(message, passageName, lineNumber);
  }
}

interface OneTimeWarnings {
  boxedBoolean?: string;
  boxedNumber?: string;
  boxedString?: string;
}
const oneTimeWarnings: OneTimeWarnings = {
  boxedBoolean:
    "You are using a boxed boolean, " +
    "constructed by calling the global `Boolean` function with the `new` keyword. " +
    "It is recommended to never use the `new` keyword with the global `Boolean` function, " +
    "as boxed booleans are always considered to be truthy, " +
    "regardless of their internal value.",
  boxedNumber:
    "You are using a boxed number, " +
    "constructed by calling the global `Number` function with the `new` keyword. " +
    "It is recommended to never use the `new` keyword with the global `Number` function, " +
    "as boxed numbers are slightly different from regular numbers.",
  boxedString:
    "You are using a boxed string, " +
    "constructed by calling the global `String` function with the `new` keyword. " +
    "It is recommended to never use the `new` keyword with the global `String` function, " +
    "as boxed strings are slightly different from regular strings.",
};

export function warnOnce(k: keyof OneTimeWarnings): void {
  const message = oneTimeWarnings[k];
  if (message) {
    oneTimeWarnings[k] = undefined;
    console.warn(message);
  }
}
