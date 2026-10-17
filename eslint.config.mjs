import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Zen downloaded by scripts/check_menus.mjs.
  { ignores: [".cache/"] },
  {
    // Development scripts and unit tests, which run in Node.
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The mod's script, run in Zen's browser windows, and the settings page,
    // a chrome:// page with the same privileges. Both are classic scripts.
    files: ["context-menu.uc.js", "context-menu/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        Cc: "readonly",
        Ci: "readonly",
        Components: "readonly",
        ChromeUtils: "readonly",
        IOUtils: "readonly",
        PathUtils: "readonly",
        Services: "readonly",
        WebExtensionPolicy: "readonly",
        gBrowser: "readonly",
      },
    },
  },
  pluginJs.configs.recommended,
];
