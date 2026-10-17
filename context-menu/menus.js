// The menus Zen Calmer Context Menu manages, and the logic shared by the
// script that runs in the browser window (context-menu.uc.js) and the settings
// page. Plain data and pure functions only: it's also loaded by the unit tests
// in Node.
//
// Every item is known by a key. Most items have an id ("#context_pinTab"),
// which stays the same across Zen updates and doesn't depend on the language.
// Items without one are known by their localization id, command or label,
// within their menu.

"use strict";

// eslint-disable-next-line no-unused-vars
var ZenContextMenuShared = (() => {
  /**
   * The menus listed in the settings, in that order. Menus with sections are
   * split into named groups (the page menu is long and changes with what you
   * right-click); the others are listed as they appear, between their
   * separators.
   */
  const MENUS = [
    {
      id: "tabContextMenu",
      name: "Tabs",
      hint: "Right-click a tab.",
    },
    {
      id: "contentAreaContextMenu",
      name: "Pages",
      hint: "Right-click a page, a link, an image or selected text.",
      sections: [
        {
          title: "Navigation",
          ids: ["context-navigation"],
        },
        {
          title: "Links",
          hint: "On a link.",
          ids: [
            "context-openlinkincurrent",
            "context-openlinkincontainertab",
            "context-openlinkintab",
            "context-openlinkinsplitview",
            "context-openlinkinusercontext-menu",
            "context-openlink",
            "context-openlinkprivate",
            "context-openlinksmartwindow",
            "context-previewlink",
            "context-zenOpenLinkInGlance",
            "context-zenSplitLink",
            "context-bookmarklink",
            "context-savelink",
            "context-copyemail",
            "context-copyphone",
            "context-copylink",
            "context-stripOnShareLink",
            "context-sendlinktodevice",
          ],
        },
        {
          title: "Images",
          hint: "On an image.",
          ids: [
            "context-reloadimage",
            "context-viewimage",
            "context-saveimage",
            "context-copyimage-contents",
            "context-copyimage",
            "context-sendimage",
            "context-imagetext",
            "context-viewimageinfo",
            "context-viewimagedesc",
            "context-visual-search",
            "context-setDesktopBackground",
          ],
        },
        {
          title: "Video and audio",
          hint: "On a video or an audio player.",
          ids: [
            "context-media-play",
            "context-media-pause",
            "context-media-mute",
            "context-media-unmute",
            "context-media-playbackrate",
            "context-media-loop",
            "context-leave-dom-fullscreen",
            "context-video-fullscreen",
            "context-media-hidecontrols",
            "context-media-showcontrols",
            "context-viewvideo",
            "context-video-pictureinpicture",
            "context-video-saveimage",
            "context-savevideo",
            "context-saveaudio",
            "context-copyvideourl",
            "context-copyaudiourl",
            "context-sendvideo",
            "context-sendaudio",
            "context-media-eme-learnmore",
          ],
        },
        {
          title: "Selected text and editing",
          hint: "On selected text, or while typing.",
          ids: [
            "context-undo",
            "context-redo",
            "context-cut",
            "context-copy",
            "context-paste",
            "context-paste-no-formatting",
            "context-delete",
            "context-selectall",
            "context-print-selection",
            "context-copy-link-to-highlight",
            "context-copy-clean-link-to-highlight",
            "context-remove-highlight",
            "context-pdfjs-comment-selection",
            "context-pdfjs-highlight-selection",
          ],
        },
        {
          title: "Search, translate and AI",
          ids: [
            "context-add-engine",
            "context-searchselect",
            "context-searchselect-private",
            "context-translate-selection",
            "context-ask-chat",
            "context-create-aitab",
          ],
        },
        {
          title: "Page",
          hint: "On an empty part of a page.",
          ids: [
            "context-savepage",
            "context-take-screenshot",
            "context-use-mini-window",
            "context-sendpagetodevice",
            "frame",
          ],
        },
        {
          title: "Text fields",
          hint: "While typing.",
          ids: [
            "spell-no-suggestions",
            "spell-add-to-dictionary",
            "spell-undo-add-to-dictionary",
            "spell-check-enabled",
            "spell-add-dictionaries-main",
            "spell-dictionaries",
            "context-bidi-text-direction-toggle",
            "context-bidi-page-direction-toggle",
            "context-reveal-password",
          ],
        },
        {
          title: "Passwords",
          hint: "In a login form.",
          ids: [
            "fill-login",
            "fill-login-generated-password",
            "use-relay-mask",
            "manage-saved-logins",
          ],
        },
        {
          title: "Developer tools",
          ids: [
            "context-viewpartialsource-selection",
            "context-viewsource",
            "context-inspect-a11y",
            "context-inspect",
            "context-viewsource-goToLine",
            "context-viewsource-wrapLongLines",
            "context-viewsource-highlightSyntax",
          ],
        },
        {
          title: "PDFs",
          hint: "In Zen's PDF viewer.",
          ids: [
            "context-pdfjs-undo",
            "context-pdfjs-redo",
            "context-pdfjs-cut",
            "context-pdfjs-copy",
            "context-pdfjs-paste",
            "context-pdfjs-delete",
            "context-pdfjs-select-all",
            "context-pdfjs-copy-page",
            "context-pdfjs-cut-page",
            "context-pdfjs-delete-page",
            "context-pdfjs-save-page",
          ],
        },
      ],
      // The page menu changes with what you right-click; the preview keeps
      // one copy for each.
      contexts: ["Page", "Link", "Image", "Video", "Selection", "Text field"],
    },
    {
      id: "toolbar-context-menu",
      name: "Sidebar",
      hint: "Right-click an empty part of the sidebar or a toolbar.",
    },
    {
      id: "placesContext",
      name: "Bookmarks",
      hint: "Right-click a bookmark or a page in your history.",
    },
    {
      id: "zenWorkspaceMoreActions",
      name: "Spaces",
      hint: "Right-click a space's name at the top of the sidebar.",
    },
    {
      id: "zenFolderActions",
      name: "Folders",
      hint: "Right-click a folder in the sidebar.",
    },
    {
      id: "zenCreateNewPopup",
      name: "New button",
      hint: "Right-click the + button at the bottom of the sidebar.",
    },
  ];

  /**
   * Items that are the same option in another state or for several tabs
   * ("Unpin Tab" for "Pin Tab", "Reload Tabs" for "Reload Tab"): one switch
   * shows or hides them all.
   */
  const ALIASES = {
    "#context_reloadSelectedTabs": "#context_reloadTab",
    "#context_playSelectedTabs": "#context_playTab",
    "#context_toggleMuteSelectedTabs": "#context_toggleMuteTab",
    "#context_zen-remove-essential": "#context_zen-add-essential",
    "#context_unpinTab": "#context_pinTab",
    "#context_pinSelectedTabs": "#context_pinTab",
    "#context_unpinSelectedTabs": "#context_pinTab",
    "#context_duplicateTabs": "#context_duplicateTab",
    "#context_bookmarkSelectedTabs": "#context_bookmarkTab",
    "#context_editNote": "#context_addNote",
    "#context_moveSplitViewToNewGroup": "#context_moveTabToNewGroup",
    "#context_ungroupSplitView": "#context_ungroupTab",
    "#toolbar-context-reloadSelectedTabs": "#toolbar-context-reloadSelectedTab",
    "#toolbar-context-bookmarkSelectedTabs":
      "#toolbar-context-bookmarkSelectedTab",
    "#context-media-pause": "#context-media-play",
    "#context-media-unmute": "#context-media-mute",
    "#context-media-showcontrols": "#context-media-hidecontrols",
    "#placesContext_openBookmarkLinks:tabs":
      "#placesContext_openBookmarkContainer:tabs",
    "#placesContext_openLinks:tabs": "#placesContext_openContainer:tabs",
    "#placesContext_show:info": "#placesContext_show_bookmark:info",
    "#placesContext_show_folder:info": "#placesContext_show_bookmark:info",
    "#placesContext_deleteFolder": "#placesContext_deleteBookmark",
    "#placesContext_delete": "#placesContext_deleteBookmark",
    "#placesContext_paste_group": "#placesContext_paste",
  };

  /**
   * Names for items whose label depends on what you right-clicked ("Search
   * Google for “...”") or that have no label of their own.
   */
  const LABELS = {
    "#context-navigation": "Back, Forward, Reload and Bookmark buttons",
    "#context-searchselect": "Search the web for the selected text",
    "#context-searchselect-private": "Search in a Private Window",
    "#context-ask-chat": "Ask an AI Chatbot",
    "#context_askChat": "Ask an AI Chatbot",
    "#context-visual-search": "Search Image with Google Lens",
    "#fill-login": "Use Saved Password",
    "#context-media-playbackrate": "Speed",
    // "Open Link in New <container> Tab", in a container tab.
    "#context-openlinkincontainertab": "Open Link in New Tab, Same Container",
    "#context_askChatSummarize": "Summarize Page",
    // On view-source: pages; their labels aren't loaded in the browser window.
    "#context-viewsource-goToLine": "Go to Line…",
    "#context-viewsource-wrapLongLines": "Wrap Long Lines",
    "#context-viewsource-highlightSyntax": "Syntax Highlighting",
  };

  /** Mods known to add menu items, recognized by their items' ids. */
  const MODS = [
    { name: "Second Sidebar", ids: /webpanel$|^context_sb2-/ },
    { name: "Tab Groups", ids: /^context_zsg-|^zsg-/ },
    { name: "Calmer Context Menu", ids: /^toolbar-context-zcm-/ },
  ];

  /**
   * The "Hide ..." options of Zen Context Menu 4 and the theme store
   * version, and the items each one hid. They're turned into hidden items
   * the first time the script runs.
   */
  const LEGACY_PREFS = {
    "uc.hidecontext.bookmark": [
      "#context_bookmarkTab",
      "#toolbar-context-bookmarkSelectedTab",
      "#context-bookmarklink",
    ],
    "uc.hidecontext.mutetab": ["#context_toggleMuteTab", "#context_playTab"],
    "uc.hidecontext.newtab": [
      "#context_openANewTab",
      "#toolbar-context-openANewTab",
    ],
    "uc.hidecontext.movetaboptions": ["#context_moveTabOptions"],
    "uc.hidecontext.movetofolder": ["#context_zenMoveToFolder"],
    "uc.hidecontext.newcontainer": [
      "#context_reopenInContainer",
      "#context-openlinkinusercontext-menu",
    ],
    "uc.hidecontext.sendtodevice": [
      "#context_sendTabToDevice",
      "#context-sendpagetodevice",
      "#context-sendlinktodevice",
    ],
    "uc.hidecontext.closetab": [
      "#context_closeTab",
      "#context_closeDuplicateTabs",
    ],
    "uc.hidecontext.closemultiple": ["#context_closeTabOptions"],
    "uc.hidecontext.askchatbot": [
      "#context-ask-chat",
      "#context_askChat",
      "#context_askChatSummarize",
    ],
    "uc.hidecontext.search": ["#context-searchselect"],
    "uc.hidecontext.searchinpriv": ["#context-searchselect-private"],
    "uc.hidecontext.translate": ["#context-translate-selection"],
    "uc.hidecontext.printselection": ["#context-print-selection"],
    "uc.hidecontext.image": [
      "#context-sendimage",
      "#context-setDesktopBackground",
      "#context-viewimageinfo",
    ],
    "uc.hidecontext.visualsearch": ["#context-visual-search"],
    "uc.hidecontext.audiovideo": [
      "#context-copyvideourl",
      "#context-copyaudiourl",
      "#context-sendvideo",
      "#context-sendaudio",
    ],
    "uc.hidecontext.checkspelling": [
      "#spell-check-enabled",
      "#spell-add-dictionaries-main",
      "#spell-dictionaries",
      "#context-bidi-text-direction-toggle",
      "#context-bidi-page-direction-toggle",
    ],
    "uc.hidecontext.highlights": [
      "#context-copy-link-to-highlight",
      "#context-copy-clean-link-to-highlight",
      "#context-remove-highlight",
    ],
    "uc.hidecontext.selectalltext": ["#context-selectall"],
    "uc.hidecontext.selectalltabs": [
      "#context_selectAllTabs",
      "#toolbar-context-selectAllTabs",
    ],
    "uc.hidecontext.reloadtab": [
      "#context_reloadTab",
      "#toolbar-context-reloadSelectedTab",
    ],
    "uc.hidecontext.duplicatetab": ["#context_duplicateTab"],
    "uc.hidecontext.unloadactions": ["#context_unloadTab"],
    "uc.hidecontext.tabappearance": [
      "#context_zen-edit-tab-title",
      "#context_zen-edit-tab-icon",
    ],
    "uc.hidecontext.spacerouting": ["#context_zen-add-domain-to-routing"],
    "uc.hidecontext.zenlink": [
      "#context-zenOpenLinkInGlance",
      "#context-zenSplitLink",
    ],
    "uc.hidecontext.inspect": [
      "#context-viewsource",
      "#context-viewpartialsource-selection",
      "#context-inspect-a11y",
      "#context-inspect",
    ],
    "uc.hidecontext.savelink": ["#context-savepage", "#context-savelink"],
    "uc.hidecontext.screenshot": ["#context-take-screenshot"],
    "uc.hidecontext.frame": ["#frame"],
    "uc.hidecontext.pin": ["#context_pinTab", "#context_zen-add-essential"],
    "uc.hidecontext.navigation": ["#context-navigation"],
  };

  /**
   * What Zen Context Menu hid by default before this version: a starting
   * point the settings page offers.
   */
  const SUGGESTED = [
    "#context_bookmarkTab",
    "#toolbar-context-bookmarkSelectedTab",
    "#context-bookmarklink",
    "#context_closeTabOptions",
    "#context_reloadTab",
    "#toolbar-context-reloadSelectedTab",
    "#context_selectAllTabs",
    "#toolbar-context-selectAllTabs",
    "#context-searchselect-private",
    "#context-print-selection",
    "#context-selectall",
  ];

  /**
   * Options of chrome.css that are on unless switched off (their
   * defaultValue in preferences.json).
   */
  const DEFAULT_ON = [
    "uc.fixcontext.ergonomicsfortabs",
    "uc.hidecontext.copylink",
  ];

  /**
   * Styles of icons for the "Icons for every option" option, the
   * preference's values. chrome.css draws Zen's; the others are style sheets
   * in context-menu/icons (scripts/build_icon_packs.mjs), with icons from
   * Context Menu Icons by Starry-AXQG.
   */
  const ICON_PACKS = [
    { id: "zen", name: "Zen" },
    { id: "fluent", name: "Fluent" },
    { id: "zenui", name: "ZenUI" },
  ];
  const PREF_ICON_PACK = "uc.fixcontext.iconpack";

  /** Firefox's id for an extension's menu items (ext-menus.js). */
  const widgetId = (extensionId) =>
    String(extensionId)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");

  /**
   * @typedef {object} ItemInfo What an item looks like, read from its element.
   * @property {string} tag "menu", "menuitem" or "menugroup"
   * @property {string} [id]
   * @property {string} [l10n] its data-l10n-id or data-lazy-l10n-id
   * @property {string} [command]
   * @property {string} [label]
   * @property {boolean} [extension] added by an extension
   * @property {string} [extType] "top-level-menu" for an extension's submenu
   */

  /**
   * The key an item's hidden state is saved under, or null if it can't be
   * told apart from other items.
   *
   * Extensions' items are recreated every time a menu opens, with an id made
   * of the extension's id and the item's. Items an extension didn't name get
   * a number that changes every session, as does the submenu holding an
   * extension's items; those are known by the extension and their label.
   *
   * @param {ItemInfo} info
   * @param {string} menuId the top-level menu the item is in
   * @returns {string | null}
   */
  function itemKey(info, menuId) {
    if (info.extension) {
      const match = /^(.+)-menuitem-(_.+|\d+)$/.exec(info.id ?? "");
      if (match) {
        if (match[2].startsWith("_")) return `#${info.id}`;
        if (info.extType === "top-level-menu") return `ext:${match[1]}`;
        return info.label ? `ext:${match[1]}|${info.label}` : null;
      }
    }
    if (info.id) return `#${info.id}`;
    if (info.l10n) return `${menuId}|l10n:${info.l10n}`;
    if (info.command) return `${menuId}|cmd:${info.command}`;
    if (info.label) return `${menuId}|label:${info.label}`;
    return null;
  }

  /** The key whose switch an item follows ("Unpin Tab" follows "Pin Tab"). */
  const canonicalKey = (key) => ALIASES[key] ?? key;

  /**
   * The extension an item key belongs to (its widget id), if any.
   *
   * @param {string} key
   * @returns {string | null}
   */
  function extensionOf(key) {
    const match =
      /^ext:([^|]+)/.exec(key) ?? /^#(.+)-menuitem-(_.+|\d+)$/.exec(key);
    return match ? match[1] : null;
  }

  /**
   * Where an item comes from, for the tag next to it in the settings: a mod's
   * name, "Zen", or null for Firefox's own items. Extensions are named by the
   * caller, which can look them up.
   *
   * @param {ItemInfo} info
   * @returns {string | null}
   */
  function sourceOf(info) {
    const id = info.id ?? "";
    const mod = MODS.find((m) => m.ids.test(id));
    if (mod) return mod.name;
    if (
      /zen/i.test(id) ||
      /^zen-/.test(info.l10n ?? "") ||
      /^cmd_zen/.test(info.command ?? "")
    ) {
      return "Zen";
    }
    return null;
  }

  /**
   * Which of a menu's visible separators to hide, so that none is left at the
   * top or bottom of the menu, or next to another one, once items are hidden.
   *
   * @param {Array<{ separator: boolean, visible: boolean }>} entries the
   *   menu's items and separators, in the order they're shown
   * @returns {Set<number>} indexes into entries
   */
  function separatorsToHide(entries) {
    const hide = new Set();
    let seenItem = false;
    let pending = -1;
    entries.forEach((entry, i) => {
      if (!entry.visible) return;
      if (!entry.separator) {
        seenItem = true;
        pending = -1;
      } else if (!seenItem || pending >= 0) {
        hide.add(i);
      } else {
        pending = i;
      }
    });
    if (pending >= 0) hide.add(pending);
    return hide;
  }

  /**
   * Splits a menu's rows into the groups the settings page lists.
   *
   * Menus with sections: each row goes to its section. An item the sections
   * don't name (Zen's, a mod's) joins the section of the item before it, so
   * it's listed next to the items it's shown with; one with no named item
   * after it was added to the end of the menu and goes to "More", and
   * extensions' items to "Extensions".
   *
   * Other menus: the rows are split where the menu has a separator.
   *
   * @param {{ sections?: Array<{ title: string, hint?: string, ids: Array<string> }> }} menu
   * @param {Array<{ key?: string, separator?: boolean, extension?: boolean }>} rows
   *   the menu's items and separators, in menu order
   * @returns {Array<{ title: string | null, hint: string | null, rows: Array<object> }>}
   */
  function groupRows(menu, rows) {
    if (!menu.sections) {
      const groups = [{ title: null, hint: null, rows: [] }];
      for (const row of rows) {
        if (row.separator) {
          if (groups.at(-1).rows.length) {
            groups.push({ title: null, hint: null, rows: [] });
          }
        } else {
          groups.at(-1).rows.push(row);
        }
      }
      return groups.filter((group) => group.rows.length);
    }

    const sectionOf = new Map();
    const groups = menu.sections.map((section, i) => {
      for (const id of section.ids) sectionOf.set(`#${id}`, i);
      return { title: section.title, hint: section.hint ?? null, rows: [] };
    });
    const more = { title: "More", hint: "Added by Zen or mods.", rows: [] };
    const extensions = { title: "Extensions", hint: null, rows: [] };
    let current = -1;
    let unplaced = [];
    for (const row of rows) {
      if (row.separator) continue;
      if (row.extension) {
        extensions.rows.push(row);
        continue;
      }
      const known = sectionOf.get(row.key);
      if (known === undefined) {
        unplaced.push(row);
        continue;
      }
      // Items between two named ones belong with the one before them.
      groups[current >= 0 ? current : known].rows.push(...unplaced);
      unplaced = [];
      current = known;
      groups[known].rows.push(row);
    }
    more.rows.push(...unplaced);
    return [...groups, more, extensions].filter((group) => group.rows.length);
  }

  /**
   * The keys to hide from the old "Hide ..." options that are turned on.
   *
   * @param {(pref: string) => boolean} isOn
   * @returns {Array<string>}
   */
  function legacyHiddenKeys(isOn) {
    return Object.entries(LEGACY_PREFS)
      .filter(([pref]) => isOn(pref))
      .flatMap(([, keys]) => keys);
  }

  /**
   * Reads the saved list of hidden items, ignoring anything that isn't one.
   *
   * @param {string} text the preference's value
   * @returns {Set<string>}
   */
  function parseHidden(text) {
    let list;
    try {
      list = JSON.parse(text);
    } catch {
      return new Set();
    }
    return new Set(
      (Array.isArray(list) ? list : [])
        .filter((key) => typeof key === "string" && key.length)
        .map(canonicalKey),
    );
  }

  /**
   * A label without the selected text it quotes ("Search Google for “...”"),
   * for saving: the selection could be anything, a password included.
   * Firefox and extensions shorten the quote, so it's found by its start and
   * removed up to the closing quote or ellipsis.
   *
   * @param {string} label
   * @param {string} selection the selected text, if any
   * @returns {string}
   */
  function withoutSelection(label, selection) {
    const head = selection.trim().slice(0, 8);
    const at = head.length >= 3 ? label.indexOf(head) : -1;
    if (at < 0) return label;
    const rest = label.slice(at);
    const end = rest.search(/[”"»」’']|…/);
    const after = end < 0 ? "" : rest.slice(rest[end] === "…" ? end + 1 : end);
    return `${label.slice(0, at)}…${after}`;
  }

  /** The value saved for a set of hidden items. */
  const serializeHidden = (keys) => JSON.stringify([...keys].sort());

  // A backup file (the settings page's Backup card): the hidden and folded
  // items and the style options. `format` tells it apart from other JSON
  // files; fields added later (`folded`) are ignored by versions before
  // them and missing from backups made before them. Raise
  // BACKUP_VERSION only when the shape changes in a way older versions would
  // misread, since they refuse newer backups.
  const BACKUP_FORMAT = "calmer-context-menu-backup";
  const BACKUP_VERSION = 1;
  // Real backups are a few kilobytes; these bound what an import reads.
  const BACKUP_MAX_LENGTH = 1024 * 1024;
  const BACKUP_MAX_ITEMS = 10000;
  const BACKUP_MAX_KEY_LENGTH = 1000;

  /**
   * The contents of a backup file.
   *
   * @param {Iterable<string>} hiddenKeys
   * @param {Object<string, boolean | string>} options the style options, by
   *   preference
   * @param {Date} [date] when it was made
   * @param {Iterable<string>} [foldedKeys] items in "More options"
   * @returns {string}
   */
  function makeBackup(hiddenKeys, options, date = new Date(), foldedKeys = []) {
    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: date.toISOString(),
      hidden: [...hiddenKeys].sort(),
      folded: [...foldedKeys].sort(),
      options: Object.fromEntries(Object.entries(options).sort()),
    };
    return `${JSON.stringify(backup, null, 2)}\n`;
  }

  /**
   * Reads a backup file. It can come from anywhere, so only what's expected
   * is taken: item keys that are strings, true or false for the style
   * options in `optionPrefs`, and one of its values for those in `choices`;
   * everything else is ignored.
   *
   * @param {string} text the file's contents
   * @param {Array<string>} optionPrefs the on/off preferences a backup may set
   * @param {Object<string, Array<string>>} [choices] the preferences with a
   *   value from a list a backup may set, and their values
   * @returns {{hidden: Set<string>, folded: Set<string>, options: Map<string, boolean | string>}}
   * @throws {Error} saying why, for the user, if it can't be restored
   */
  function parseBackup(text, optionPrefs, choices = {}) {
    if (typeof text !== "string" || text.length > BACKUP_MAX_LENGTH) {
      throw new Error("This file is too big to be a backup.");
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("This file isn't a backup (it isn't JSON).");
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.format !== BACKUP_FORMAT
    ) {
      throw new Error("This file isn't a Calmer Context Menu backup.");
    }
    if (!Number.isInteger(data.version) || data.version < 1) {
      throw new Error("This backup has no version.");
    }
    if (data.version > BACKUP_VERSION) {
      throw new Error(
        "This backup was made by a newer version of the mod. Update the mod to restore it.",
      );
    }
    const keys = (list, what) => {
      if (!Array.isArray(list) || list.length > BACKUP_MAX_ITEMS) {
        throw new Error(`This backup's list of ${what} items is damaged.`);
      }
      return new Set(
        list
          .filter(
            (key) =>
              typeof key === "string" &&
              key.length > 0 &&
              key.length <= BACKUP_MAX_KEY_LENGTH,
          )
          .map(canonicalKey),
      );
    };
    const hidden = keys(data.hidden, "hidden");
    // Made before items could be folded: none were.
    const folded = Object.hasOwn(data, "folded")
      ? keys(data.folded, "folded")
      : new Set();
    const values =
      data.options &&
      typeof data.options === "object" &&
      !Array.isArray(data.options)
        ? data.options
        : {};
    const options = new Map();
    for (const pref of optionPrefs) {
      if (Object.hasOwn(values, pref) && typeof values[pref] === "boolean") {
        options.set(pref, values[pref]);
      }
    }
    for (const [pref, allowed] of Object.entries(choices)) {
      if (Object.hasOwn(values, pref) && allowed.includes(values[pref])) {
        options.set(pref, values[pref]);
      }
    }
    return { hidden, folded, options };
  }

  return Object.freeze({
    MENUS,
    ALIASES,
    LABELS,
    MODS,
    LEGACY_PREFS,
    SUGGESTED,
    DEFAULT_ON,
    ICON_PACKS,
    PREF_ICON_PACK,
    PREF_HIDDEN: "uc.hidecontext.items",
    PREF_FOLDED: "uc.hidecontext.folded",
    widgetId,
    itemKey,
    canonicalKey,
    extensionOf,
    sourceOf,
    separatorsToHide,
    groupRows,
    legacyHiddenKeys,
    parseHidden,
    serializeHidden,
    withoutSelection,
    BACKUP_MAX_LENGTH,
    makeBackup,
    parseBackup,
  });
})();
