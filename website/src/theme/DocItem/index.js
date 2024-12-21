/**
 * @module DocItem
 *
 * Extend the built-in `DocItem` component with a warning admonition.
 * This admonition is only displayed when viewing documentation for an
 * unreleased version of Brick.
 *
 * ReadTheDocs.org has a built-in toast that displays in the top-right,
 * but that is subtle and quickly fades away.
 * This admonition is persistent and obvious.
 */

import React from "react";
import DocItem from "@theme-original/DocItem";
import Admonition from "@theme/Admonition";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useIsBrowser from "@docusaurus/useIsBrowser";

export default function DocItemWrapper(props) {
  const { siteConfig } = useDocusaurusContext();
  const isBrowser = useIsBrowser();

  let warning = null;
  if (isBrowser && siteConfig.customFields.rtdVersion === "latest") {
    const stableLink = <a href={location.href.replace("/latest/", "/stable/")}>here</a>;
    warning = (
      <Admonition type="warning" title="Unstable Documentation">
        You are viewing documentation for an unreleased version of Brick.
        Documentation for the latest release can be found {stableLink}.
      </Admonition>
    );
  }

  return (
    <>
      {warning}
      <DocItem {...props} />
    </>
  );
}
