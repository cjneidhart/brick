import { MacroContext } from "./macros";

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
    super(`Error while executing @${context.name}`, context.passageName, context.lineNumber);
    this.cause = cause;
  }
}
