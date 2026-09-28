import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // The mod itself is CSS; the only JavaScript is development scripts and
    // unit tests, which run in Node.
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  pluginJs.configs.recommended,
];
