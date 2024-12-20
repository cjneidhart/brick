import React, { isValidElement } from "react";
import useIsBrowser from "@docusaurus/useIsBrowser";
import { parseLanguage } from "@docusaurus/theme-common/internal";

/**
 * Best attempt to make the children a plain string so it is copyable. If there
 * are react elements, we will not be able to copy the content, and it will
 * return `children` as-is; otherwise, it concatenates the string children
 * together.
 */
function maybeStringifyChildren(children) {
  if (React.Children.toArray(children).some((el) => isValidElement(el))) {
    return children;
  }
  // The children is now guaranteed to be one/more plain strings
  return Array.isArray(children) ? children.join("") : children;
}

export default function CodeBlock({
  children: rawChildren,
  className,
  language: languageProp,
  ..._props
}) {
  const language = (languageProp ?? parseLanguage(className))?.toLowerCase();
  const children = maybeStringifyChildren(rawChildren);

  const isBrowser = useIsBrowser();

  if (isBrowser) {
    const codeMirror = require("codemirror");
    require("codemirror/addon/runmode/runmode");
    const {register: registerBrick} = require("brick-codemirror");
    registerBrick(codeMirror);
    const output = [];
    codeMirror.runMode(children, language, (text, cls) => {
      const classes = cls?.split(" ").map((c) => "cm-" + c).join(" ");
      output.push(
        <span className={classes} key={output.length}>
          {text}
        </span>
      );
    });
    return (
      <pre className="code-block">
        <code>{output}</code>
      </pre>
    );
  } else {
    return (
      <pre>
        <code>{children}</code>
      </pre>
    );
  }
}
