// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Pear Pong',
  tagline: 'P2P Pong — no servers, just paddles',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://hakierka.github.io',
  baseUrl: '/pear-pong/',

  organizationName: 'hakierka',
  projectName: 'pear-pong',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
          editUrl: 'https://github.com/hakierka/pear-pong/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Pear Pong 🏓',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/hakierka/pear-pong',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Learn',
            items: [
              { label: 'App Overview', to: '/' },
              { label: 'Architecture', to: '/architecture' },
              { label: 'Walkthrough', to: '/walkthrough' },
            ],
          },
          {
            title: 'Resources',
            items: [
              { label: 'Pear Docs', href: 'https://docs.pears.com/' },
              { label: 'Hyperswarm', href: 'https://docs.pears.com/building-blocks/hyperswarm' },
              { label: 'Hypercore', href: 'https://docs.pears.com/building-blocks/hypercore' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'GitHub', href: 'https://github.com/hakierka/pear-pong' },
              { label: '@amywaliszewska', href: 'https://x.com/amywaliszewska' },
            ],
          },
        ],
        copyright: `Built with 🍐 by Amy Waliszewska`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
