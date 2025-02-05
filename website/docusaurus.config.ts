import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const fullUrl = URL.parse(
  process.env.READTHEDOCS_CANONICAL_URL ||
    "https://brick-if.readthedocs.io/en/latest"
);

import { version as brickVersion } from "brick/package.json";

const config: Config = {
  title: "Brick",
  tagline: "A modern story format",
  favicon: "img/favicon.ico?v=2",

  // Set the production url of your site here
  url: fullUrl.origin,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: fullUrl.pathname,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "cjneidhart", // Usually your GitHub org/user name.
  projectName: "brick", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          breadcrumbs: false,
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl: "https://github.com/cjneidhart/brick",
        },
        blog: false,
        // blog: {
        //   showReadingTime: true,
        //   feedOptions: {
        //     type: ["rss", "atom"],
        //     xslt: true,
        //   },
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   editUrl:
        //     "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        //   // Useful options to enforce blogging best practices
        //   onInlineTags: "warn",
        //   onInlineAuthors: "warn",
        //   onUntruncatedBlogPosts: "warn",
        // },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/brick-social-card.jpg",
    navbar: {
      title: "Brick",
      logo: {
        alt: "Brick Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "referenceSidebar",
          position: "left",
          label: "Reference",
        },
        // { to: "/blog", label: "Blog", position: "left" },
        {
          href: "https://github.com/cjneidhart/brick",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Reference",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Twine",
              href: "https://twinery.org",
            },
            {
              label: "Discord - Twine Games",
              href: "https://discord.gg/n5dJvPp",
            },
            {
              label: "Reddit - Twine Games",
              href: "https://reddit.com/r/twinegames",
            },
          ],
        },
        {
          title: "More",
          items: [
            // {
            //   label: "Blog",
            //   to: "/blog",
            // },
            {
              label: "GitHub",
              href: "https://github.com/cjneidhart/brick",
            },
          ],
        },
      ],
      copyright:
        `Copyright © ${new Date().getFullYear()} Chris Neidhart. Built with Docusaurus.<br>` +
        `🏳️‍⚧️ Trans Rights are Human Rights`,
    },
  } satisfies Preset.ThemeConfig,
  customFields: {
    brickDownloadUrl: `https://cjneidhart.github.io/brick/v${brickVersion}/format.js`,
    rtdVersion: process.env.READTHEDOCS_VERSION || "latest",
  },
};

export default config;
