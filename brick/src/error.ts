import { MacroContext } from "./macros";
import { ElementTemplate } from "./parser";

export class BrickError extends Error {
  /** The name of the passage the error occurred in */
  passage?: string;
  /** The line number of that passage */
  lineNumber?: number;
  constructor(message: string, passage: string, lineNumber: number) {
    super(`in “${passage}” at line ${lineNumber}: ${message}`);
    this.passage = passage;
    this.lineNumber = lineNumber;
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
