// Pure helpers for reading chrome.css and browser sources, shared by
// scripts/check_selector_targets.mjs and the unit tests. No network or file
// access here, so Node tests can run everything.

/**
 * Ids created at runtime from another id (the toolbar context menu builds
 * "toggle_<toolbar id>" items), mapped to the id they're built from.
 */
export const DYNAMIC_IDS = {
  toggle_PersonalToolbar: "PersonalToolbar",
  "toggle_toolbar-menubar": "toolbar-menubar",
};

/**
 * @param {string} css
 * @returns {string} css without comments
 */
export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Preferences used in `@media -moz-pref("...")` queries.
 *
 * @param {string} css
 * @returns {Set<string>}
 */
export function extractPrefs(css) {
  const prefs = new Set();
  for (const [, pref] of stripComments(css).matchAll(
    /-moz-pref\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    prefs.add(pref);
  }
  return prefs;
}

/**
 * chrome:// URLs referenced by url(...).
 *
 * @param {string} css
 * @returns {Set<string>}
 */
export function extractChromeUrls(css) {
  const urls = new Set();
  for (const [, url] of stripComments(css).matchAll(
    /url\(\s*["']?(chrome:\/\/[^"')\s]+)["']?\s*\)/g,
  )) {
    urls.add(url);
  }
  return urls;
}

/**
 * Element ids and classes the style sheet's selectors (and -moz-element())
 * point at.
 *
 * @param {string} css
 * @returns {{ ids: Set<string>, classes: Set<string> }}
 */
export function extractSelectorTargets(css) {
  const ids = new Set();
  const classes = new Set();
  let text = stripComments(css)
    .replace(/url\([^)]*\)/g, "")
    .replace(/-moz-pref\([^)]*\)/g, "");
  for (const [, id] of text.matchAll(/\[id=["']([^"']+)["']\]/g)) {
    ids.add(id);
  }
  // Attribute values (labels, l10n ids...) aren't selectors.
  text = text.replace(/"[^"]*"|'[^']*'/g, '""');
  for (const [, id] of text.matchAll(/#(-?[A-Za-z_][\w-]*)/g)) {
    ids.add(id);
  }
  for (const [, cls] of text.matchAll(/(?<![\w-])\.(-?[A-Za-z_][\w-]*)/g)) {
    classes.add(cls);
  }
  return { ids, classes };
}

const ID_PATTERNS = [
  // markup: id="x", but not data-l10n-id="x"
  /(?<![\w-])id\s*=\s*["']([^"'\s$]+)["']/g,
  /(?<![\w-])id:\s*["']([^"'\s$]+)["']/g, // object literals: { id: "x" }
  /setAttribute\(\s*["']id["']\s*,\s*["']([^"'\s$]+)["']/g,
  /\.id\s*=\s*["']([^"'\s$]+)["']/g,
];

/**
 * Ids a markup or script source defines.
 *
 * @param {string} source
 * @returns {Set<string>}
 */
export function extractDefinedIds(source) {
  const ids = new Set();
  for (const pattern of ID_PATTERNS) {
    for (const [, id] of source.matchAll(pattern)) {
      ids.add(id);
    }
  }
  return ids;
}

const CLASS_LIST_PATTERNS = [
  /(?<![\w-])class\s*=\s*["']([^"']+)["']/g, // markup: class="a b"
  /\.className\s*=\s*["']([^"']+)["']/g,
  /setAttribute\(\s*["']class["']\s*,\s*["']([^"']+)["']/g,
];

/**
 * Classes a markup or script source adds to elements.
 *
 * @param {string} source
 * @returns {Set<string>}
 */
export function extractDefinedClasses(source) {
  const classes = new Set();
  const add = (list) => {
    for (const cls of list.split(/\s+/)) {
      if (/^-?[A-Za-z_][\w-]*$/.test(cls)) {
        classes.add(cls);
      }
    }
  };
  for (const pattern of CLASS_LIST_PATTERNS) {
    for (const [, list] of source.matchAll(pattern)) {
      add(list);
    }
  }
  // classList.add("a", "b") / classList.toggle("a", ...)
  for (const [, args] of source.matchAll(
    /classList\.(?:add|toggle)\(([^)]*)\)/g,
  )) {
    for (const [, cls] of args.matchAll(/["']([^"']+)["']/g)) {
      add(cls);
    }
  }
  return classes;
}

/**
 * chrome:// URLs a jar manifest (jar.mn / jar.inc.mn, or a patch adding lines
 * to one) packages, e.g.
 * "skin/classic/browser/zen-icons/pin.svg" -> "chrome://browser/skin/zen-icons/pin.svg".
 *
 * @param {string} manifest
 * @returns {Set<string>}
 */
export function extractJarUrls(manifest) {
  const urls = new Set();
  for (const [, pkg, path] of manifest.matchAll(
    /^\+?\s*\*?\s*skin\/classic\/([\w-]+)\/(\S+)/gm,
  )) {
    urls.add(`chrome://${pkg}/skin/${path}`);
  }
  return urls;
}

/**
 * Compares what chrome.css points at with what the browser sources define.
 *
 * @param {string} css
 * @param {{ ids: Set<string>, classes: Set<string>, urls: Set<string> }} defined
 * @returns {Array<string>} problems
 */
export function findMissingTargets(css, defined) {
  const problems = [];
  const { ids, classes } = extractSelectorTargets(css);
  for (const id of [...ids].sort()) {
    const base = DYNAMIC_IDS[id];
    if (base ? !defined.ids.has(base) : !defined.ids.has(id)) {
      problems.push(`#${id} is not defined anymore`);
    }
  }
  for (const cls of [...classes].sort()) {
    if (!defined.classes.has(cls)) {
      problems.push(`.${cls} is not used anymore`);
    }
  }
  for (const url of [...extractChromeUrls(css)].sort()) {
    if (!defined.urls.has(url)) {
      problems.push(`${url} is not packaged anymore`);
    }
  }
  return problems;
}

/**
 * The text of each option's top-level `@media -moz-pref("...")` block, keyed
 * by preference. Rules nested inside a block (including ones that also need
 * another option) belong to it.
 *
 * @param {string} css
 * @returns {Map<string, string>}
 */
export function extractOptionBlocks(css) {
  const blocks = new Map();
  const code = stripComments(css);
  const re = /@media\s+-moz-pref\(\s*["']([^"']+)["']\s*\)[^{]*\{/g;
  let match;
  while ((match = re.exec(code))) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
    }
    const body = code.slice(re.lastIndex, i - 1);
    blocks.set(match[1], (blocks.get(match[1]) ?? "") + body);
    re.lastIndex = i;
  }
  return blocks;
}

/**
 * Separator problems in a menu, given its visible entries from top to bottom
 * (separators as `{ separator: true }`).
 *
 * @param {Array<{ separator?: boolean, id?: string }>} entries
 * @returns {Array<string>}
 */
export function lintSeparators(entries) {
  const problems = [];
  const name = (entry) => (entry.id ? `#${entry.id}` : "a separator");
  if (entries[0]?.separator) {
    problems.push(`${name(entries[0])} is at the top`);
  }
  if (entries.length > 1 && entries.at(-1).separator) {
    problems.push(`${name(entries.at(-1))} is at the bottom`);
  }
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].separator && entries[i - 1].separator) {
      problems.push(
        `${name(entries[i - 1])} and ${name(entries[i])} are next to each other`,
      );
    }
  }
  return problems;
}
