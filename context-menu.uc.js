// ==UserScript==
// @name           Zen Context Menu Enhanced
// @description    Hide the options you don't use from Zen's right-click menus, including the ones Zen, other mods and extensions add.
// @include        main
// ==/UserScript==

(() => {
  // Loaded again in the same window (Sine reloads a mod's scripts when it's
  // updated or switched back on): undo the previous copy first.
  window.ZenContextMenu?.unload();

  // This mod's id in Sine (from theme.json).
  const SINE_MOD_ID = "zen-context-menu";
  // The settings page and shared code sit in a "context-menu" folder next to
  // this script, wherever the mod manager (Sine, fx-autoconfig...) put it.
  const SCRIPT_URL = Components.stack.filename
    .split(" -> ")
    .pop()
    .replace(/[?#].*$/, "");
  const SETTINGS_URL = new URL("context-menu/settings.html", SCRIPT_URL).href;
  const scope = {};
  Services.scriptloader.loadSubScript(
    new URL("context-menu/menus.js", SCRIPT_URL).href,
    scope,
  );
  const Z = scope.ZenContextMenuShared;
  const MENU_IDS = new Set(Z.MENUS.map((menu) => menu.id));

  // What the menus showed when they were opened: labels and icons for the
  // settings page, items that only exist while a menu is open (extensions'),
  // and the order for its preview.
  const DATA_FILE = PathUtils.join(
    PathUtils.profileDir,
    "zen-context-menu.json",
  );
  // Items not seen for this long are forgotten, unless they're hidden.
  const FORGET_AFTER = 180 * 24 * 60 * 60 * 1000;

  const ITEM_TAGS = new Set(["menu", "menuitem", "menugroup"]);
  const isItem = (el) => ITEM_TAGS.has(el.localName);
  const isSeparator = (el) => el.localName === "menuseparator";

  const cleanups = [];
  const log = (...args) =>
    console.error("[Zen Context Menu Enhanced]", ...args);

  /* ---------- hidden items ---------- */

  let hidden = new Set();
  const readHidden = () => {
    hidden = Z.parseHidden(Services.prefs.getStringPref(Z.PREF_HIDDEN, "[]"));
  };
  const writeHidden = (keys) =>
    Services.prefs.setStringPref(Z.PREF_HIDDEN, Z.serializeHidden(keys));

  // The "Hide ..." options of earlier versions become hidden items, once.
  function migrateLegacyPrefs() {
    const set = Object.keys(Z.LEGACY_PREFS).filter((pref) =>
      Services.prefs.prefHasUserValue(pref),
    );
    if (!set.length) {
      return;
    }
    const keys = Z.legacyHiddenKeys((pref) => {
      try {
        return Services.prefs.getBoolPref(pref, false);
      } catch {
        return false;
      }
    });
    if (keys.length) {
      readHidden();
      writeHidden(new Set([...hidden, ...keys.map(Z.canonicalKey)]));
    }
    set.forEach((pref) => Services.prefs.clearUserPref(pref));
  }

  // Options that are on until switched off. As defaults (not saved values)
  // they apply before anyone opens the settings, and go away with the mod.
  function setDefaultPrefs() {
    const defaults = Services.prefs.getDefaultBranch("");
    for (const pref of Z.DEFAULT_ON) {
      try {
        defaults.setBoolPref(pref, true);
      } catch (ex) {
        log(`couldn't set the default of ${pref}`, ex);
      }
    }
  }

  /* ---------- reading items ---------- */

  /** @returns {object} an ItemInfo (see menus.js) */
  function infoOf(el) {
    return {
      tag: el.localName,
      id: el.id,
      l10n:
        el.getAttribute("data-l10n-id") ||
        el.getAttribute("data-lazy-l10n-id") ||
        "",
      command: el.getAttribute("command") || "",
      label: el.getAttribute("label") || "",
      extension: el.classList.contains("webextension-menuitem"),
      extType: el.getAttribute("ext-type") || "",
    };
  }

  // The managed menu a popup belongs to: the popup itself, or the menu one of
  // its submenus (or their submenus) opens from.
  function rootMenuOf(popup) {
    let current = popup;
    for (let depth = 0; current && depth < 4; depth++) {
      if (current.localName === "menupopup" && MENU_IDS.has(current.id)) {
        return current;
      }
      const menu = current.parentElement;
      if (menu?.localName !== "menu") {
        return null;
      }
      current = menu.parentElement;
    }
    return null;
  }

  function keyOf(el, root) {
    return Z.itemKey(infoOf(el), root.id);
  }

  const shown = (el) =>
    !el.hidden && window.getComputedStyle(el).display !== "none";

  // Items and separators in the order they're shown: the reorder option
  // moves tab menu items around with CSS `order`.
  function inShownOrder(popup) {
    return [...popup.children]
      .filter((el) => isItem(el) || isSeparator(el))
      .map((el, i) => ({
        el,
        i,
        order: parseInt(window.getComputedStyle(el).order, 10) || 0,
      }))
      .sort((a, b) => a.order - b.order || a.i - b.i)
      .map(({ el }) => el);
  }

  /* ---------- hiding ---------- */

  // For each open popup, the elements this script hid. They're shown again
  // when it closes, so whatever shows or hides them next (Firefox, Zen, a
  // mod) starts from the state it left them in.
  const states = new Map();

  function shouldHide(el, root) {
    const key = keyOf(el, root);
    return !!key && hidden.has(Z.canonicalKey(key));
  }

  function apply(popup, root) {
    const state = states.get(popup);
    for (const el of [...state.hid]) {
      if (el.parentElement !== popup) {
        state.hid.delete(el);
      } else if (isSeparator(el) || !shouldHide(el, root)) {
        el.hidden = false;
        state.hid.delete(el);
      }
    }
    for (const el of popup.children) {
      if (isItem(el) && !el.hidden && shouldHide(el, root)) {
        el.hidden = true;
        state.hid.add(el);
      }
    }
    // Firefox tidies separators before this runs, in DOM order, and mods
    // that show or hide their items after it can leave two in a row.
    const ordered = inShownOrder(popup);
    const entries = ordered.map((el) => ({
      separator: isSeparator(el),
      visible: shown(el),
    }));
    for (const i of Z.separatorsToHide(entries)) {
      ordered[i].hidden = true;
      state.hid.add(ordered[i]);
    }
    // Our own changes aren't news to the observer.
    state.observer.takeRecords();
  }

  function watch(popup, root) {
    if (states.has(popup)) {
      states.get(popup).applies = 0;
      return states.get(popup);
    }
    const state = { hid: new Set(), observer: null, applies: 0 };
    // Items added, shown or hidden while the menu is open (extensions'
    // items, labels Firefox looks up later...).
    state.observer = new MutationObserver((records) => {
      let changed = false;
      for (const record of records) {
        if (record.type === "childList" && record.target === popup) {
          changed = true;
        } else if (
          record.type === "attributes" &&
          record.target.parentElement === popup
        ) {
          changed = true;
          // Someone else showed or hid it: it's theirs again.
          state.hid.delete(record.target);
        }
      }
      // Don't fight a script that insists on showing an item.
      if (changed && state.applies++ < 20) {
        apply(popup, root);
      }
    });
    state.observer.observe(popup, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    states.set(popup, state);
    return state;
  }

  function restore(popup) {
    const state = states.get(popup);
    if (!state) {
      return;
    }
    state.observer.disconnect();
    for (const el of state.hid) {
      el.hidden = false;
    }
    states.delete(popup);
  }

  // On the window, so it runs after the menu's own listeners (Firefox's,
  // Zen's and other mods') have decided what to show.
  function onPopupShowing(event) {
    const popup = event.target;
    if (popup.localName !== "menupopup" || event.defaultPrevented) {
      return;
    }
    const root = rootMenuOf(popup);
    if (!root) {
      return;
    }
    try {
      watch(popup, root);
      apply(popup, root);
    } catch (ex) {
      log(ex);
    }
  }

  function onPopupShown(event) {
    const popup = event.target;
    const root = popup.localName === "menupopup" && rootMenuOf(popup);
    if (root) {
      // Labels are filled in by Fluent right after the menu shows.
      setTimeout(() => {
        if (popup.state === "open") {
          record(popup, root);
        }
      }, 250);
    }
  }

  function onPopupHidden(event) {
    restore(event.target);
  }

  /* ---------- what the menus showed ---------- */

  let data = { items: {}, snapshots: {} };

  function cleanData(raw) {
    const clean = { items: {}, snapshots: {} };
    const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (!isObject(raw)) {
      return clean;
    }
    for (const [key, item] of Object.entries(
      isObject(raw.items) ? raw.items : {},
    )) {
      if (
        isObject(item) &&
        MENU_IDS.has(item.menu) &&
        Number.isFinite(item.seen)
      ) {
        clean.items[key] = item;
      }
    }
    for (const [name, snap] of Object.entries(
      isObject(raw.snapshots) ? raw.snapshots : {},
    )) {
      if (
        isObject(snap) &&
        Array.isArray(snap.entries) &&
        Number.isFinite(snap.at)
      ) {
        clean.snapshots[name] = snap;
      }
    }
    return clean;
  }

  // Keeps the newest of each item and snapshot.
  function mergeData(into, from) {
    for (const [key, item] of Object.entries(from.items)) {
      if (!into.items[key] || into.items[key].seen < item.seen) {
        into.items[key] = item;
      }
    }
    for (const [name, snap] of Object.entries(from.snapshots)) {
      if (!into.snapshots[name] || into.snapshots[name].at < snap.at) {
        into.snapshots[name] = snap;
      }
    }
  }

  const loaded = (async () => {
    try {
      mergeData(data, cleanData(await IOUtils.readJSON(DATA_FILE)));
    } catch {
      // Not saved yet.
    }
  })();

  let saveTimer = null;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 2000);
  };

  async function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      // Other windows save too: keep what they saw.
      try {
        mergeData(data, cleanData(await IOUtils.readJSON(DATA_FILE)));
      } catch {
        // Nothing saved yet.
      }
      const now = Date.now();
      for (const [key, item] of Object.entries(data.items)) {
        if (
          now - item.seen > FORGET_AFTER &&
          !hidden.has(Z.canonicalKey(key))
        ) {
          delete data.items[key];
        }
      }
      for (const [name, snap] of Object.entries(data.snapshots)) {
        if (now - snap.at > FORGET_AFTER) {
          delete data.snapshots[name];
        }
      }
      await IOUtils.writeJSON(
        DATA_FILE,
        { version: 1, ...data },
        { tmpPath: `${DATA_FILE}.tmp` },
      );
    } catch (ex) {
      log("couldn't save", ex);
    }
  }

  function extensionName(key) {
    const widget = Z.extensionOf(key);
    if (!widget) {
      return null;
    }
    try {
      const policy = WebExtensionPolicy.getActiveExtensions().find(
        (p) => Z.widgetId(p.id) === widget,
      );
      return policy?.name ?? null;
    } catch {
      return null;
    }
  }

  // What the page menu was opened on: it keeps a preview for each.
  function pageContext() {
    const menu = window.gContextMenu;
    if (!menu) return "Page";
    if (menu.onTextInput || menu.onEditable) return "Text field";
    if (menu.onImage || menu.onCanvas) return "Image";
    if (menu.onVideo || menu.onAudio) return "Video";
    if (menu.onLink) return "Link";
    if (menu.isTextSelected) return "Selection";
    return "Page";
  }

  const ownIcon = (el) => {
    const image = el.getAttribute("image") || "";
    return /^(chrome|moz-extension|data|resource|https?):/.test(image)
      ? image
      : null;
  };

  // The icon an open menu draws for an item, if any: its own, or one from a
  // style sheet (Zen's, or this mod's "Icons for every option").
  function shownIcon(el) {
    const slot = el.querySelector(":scope > .menu-icon");
    if (!slot) {
      return ownIcon(el);
    }
    const style = window.getComputedStyle(slot);
    if (style.display === "none" || style.visibility === "hidden") {
      return null;
    }
    for (const value of [style.content, style.listStyleImage]) {
      const url = /url\("([^"]+)"\)/.exec(value)?.[1];
      // Not the empty image that keeps labels lined up.
      if (url && !/^data:image\/svg\+xml,[^,]*%3Csvg[^>]*\/%3E$/i.test(url)) {
        return url;
      }
    }
    return ownIcon(el);
  }

  // Saves what an open menu shows (and what this script hid in it).
  function record(popup, root) {
    const now = Date.now();
    // Text from the page that labels may quote: the selection, or the
    // link's text ("Search Google for “<link text>”").
    const pageText =
      root.id === "contentAreaContextMenu"
        ? [window.gContextMenu?.selectedText, window.gContextMenu?.linkTextStr]
            .map((text) => String(text ?? "").trim())
            .filter(Boolean)
        : [];
    const parent = popup === root ? null : keyOf(popup.parentElement, root);
    const hid = states.get(popup)?.hid ?? new Set();
    const entries = [];
    let prev = null;
    for (const el of inShownOrder(popup)) {
      if (!hid.has(el) && !shown(el)) {
        continue;
      }
      if (isSeparator(el)) {
        entries.push({ separator: true });
        continue;
      }
      const info = infoOf(el);
      const key = Z.itemKey(info, root.id);
      if (!key) {
        continue;
      }
      const label = pageText.reduce(
        (text, quoted) => Z.withoutSelection(text, quoted),
        info.label || el.label || Z.LABELS[Z.canonicalKey(key)] || "",
      );
      const item = {
        menu: root.id,
        parent,
        prev,
        label,
        icon: shownIcon(el),
        source: info.extension
          ? extensionName(key) || "Extension"
          : Z.sourceOf(info),
        extension: info.extension || undefined,
        submenu: el.localName === "menu" || undefined,
        seen: now,
      };
      data.items[key] = item;
      prev = key;
      entries.push({
        key,
        label:
          Z.LABELS[Z.canonicalKey(key)] && !label
            ? Z.LABELS[Z.canonicalKey(key)]
            : label,
        icon: item.icon,
        submenu: item.submenu,
        disabled: el.hasAttribute("disabled") || undefined,
      });
    }
    if (popup === root) {
      const name =
        root.id === "contentAreaContextMenu"
          ? `${root.id}/${pageContext()}`
          : root.id;
      data.snapshots[name] = { at: now, entries };
    }
    saveSoon();
  }

  /* ---------- the settings page's view of the menus ---------- */

  // Icons the "Restore icons" option gives items, read from chrome.css next
  // to this script, so the settings page can show them too.
  let cssIconsPromise = null;
  function cssIcons() {
    cssIconsPromise ??= (async () => {
      const icons = new Map();
      try {
        const response = await fetch(new URL("chrome.css", SCRIPT_URL).href);
        const css = (await response.text()).replace(/\/\*[\s\S]*?\*\//g, "");
        const start = css.indexOf('-moz-pref("uc.fixcontext.restoreicons")');
        if (start < 0) {
          return icons;
        }
        const rule = /([^{};]+)\{\s*--menu-image:\s*url\("([^"]+)"\)/g;
        for (const [, selectors, url] of css.slice(start).matchAll(rule)) {
          for (const selector of splitSelectors(selectors)) {
            const id =
              /^#([\w-]+)$/.exec(selector)?.[1] ??
              /^(?:menu|menuitem)\[id="([^"]+)"\]$/.exec(selector)?.[1];
            if (id && !url.startsWith("data:")) {
              icons.set(`#${id}`, url);
            }
          }
        }
      } catch {
        // No chrome.css next to the script (installed by hand): no icons.
      }
      return icons;
    })();
    return cssIconsPromise;
  }

  function splitSelectors(text) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const char of text) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    return parts.filter(Boolean);
  }

  // Labels from the items' localization ids, with counts set to one ("Close
  // Tab", not "Close 3 Tabs" because you last right-clicked three).
  async function l10nLabels(elements) {
    const requests = [];
    const owners = [];
    for (const el of elements) {
      const id =
        el.getAttribute("data-l10n-id") || el.getAttribute("data-lazy-l10n-id");
      if (!id) {
        continue;
      }
      let args = {};
      try {
        args = JSON.parse(el.getAttribute("data-l10n-args") || "{}") ?? {};
      } catch {
        // Formatted without arguments.
      }
      for (const [name, value] of Object.entries(args)) {
        if (typeof value === "number") {
          args[name] = 1;
        }
      }
      requests.push({ id, args });
      owners.push(el);
    }
    const labels = new Map();
    try {
      const messages = await document.l10n.formatMessages(requests);
      messages.forEach((message, i) => {
        const label =
          message?.attributes?.find((a) => a.name === "label")?.value ??
          message?.value;
        if (label) {
          labels.set(owners[i], label);
        }
      });
    } catch {
      // Fall back to the labels the items have.
    }
    return labels;
  }

  function humanize(key) {
    const name = key
      .replace(/^.*\|(l10n|cmd|label):/, "")
      .replace(/^#/, "")
      .replace(/^(context|toolbar-context|placesContext)[-_]/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_:]+/g, " ")
      .trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * One menu's items for the settings page, its submenus' items inside
   * theirs. Includes items seen in the menu before that aren't there now
   * (extensions' items only exist while the menu is open).
   */
  async function rowsOf(popup, root, parentKey, icons) {
    // In the order the menu shows them, split where it shows a separator.
    const elements = inShownOrder(popup).filter(
      (el) => isItem(el) || shown(el),
    );
    const labels = await l10nLabels(elements.filter(isItem));
    const list = [];
    const byKey = new Map();

    const addRow = (key, row, liveLabel) => {
      const canonical = Z.canonicalKey(key);
      const existing = byKey.get(canonical);
      if (!existing) {
        row.key = canonical;
        row.variants = [];
        byKey.set(canonical, row);
        list.push(row);
        return;
      }
      // Another state of an item already listed ("Unpin Tab").
      const label = liveLabel || row.label;
      if (key === canonical) {
        existing.variants.push(existing.label);
        existing.label = label;
        existing.icon = row.icon ?? existing.icon;
      } else {
        existing.variants.push(label);
      }
      existing.situational &&= row.situational;
    };

    for (const el of elements) {
      if (isSeparator(el)) {
        list.push({ separator: true });
        continue;
      }
      const info = infoOf(el);
      const key = Z.itemKey(info, root.id);
      if (!key) {
        continue;
      }
      const saved = data.items[key];
      const canonical = Z.canonicalKey(key);
      // What was saved when the menu was open comes before the live label,
      // which may still quote the last selected text.
      const label =
        Z.LABELS[canonical] ||
        labels.get(el) ||
        saved?.label ||
        info.label ||
        humanize(key);
      const row = {
        label,
        icon:
          ownIcon(el) ??
          saved?.icon ??
          icons.get(key) ??
          icons.get(canonical) ??
          null,
        source: info.extension
          ? extensionName(key) || saved?.source || "Extension"
          : Z.sourceOf(info),
        extension: info.extension,
        // Hidden by the browser now and never seen: shows up only in some
        // situations, or not at all in Zen.
        situational: el.hidden && !saved,
        children: [],
      };
      const submenu =
        el.localName === "menu" && el.querySelector(":scope > menupopup");
      if (submenu && parentKey === null) {
        row.children = (await rowsOf(submenu, root, key, icons)).filter(
          (r) => !r.separator,
        );
      }
      addRow(key, row, labels.get(el) || saved?.label || info.label);
    }

    // Seen before, but not in the menu now: after the item it followed.
    const missing = Object.entries(data.items)
      .filter(
        ([key, item]) =>
          item.menu === root.id &&
          item.parent === parentKey &&
          !byKey.has(Z.canonicalKey(key)),
      )
      .sort((a, b) => a[1].seen - b[1].seen);
    for (const [key, item] of missing) {
      const canonical = Z.canonicalKey(key);
      if (byKey.has(canonical)) {
        addRow(key, { label: item.label }, item.label);
        continue;
      }
      const row = {
        key: canonical,
        label: Z.LABELS[canonical] || item.label || humanize(key),
        icon: item.icon ?? icons.get(key) ?? null,
        source: item.source ?? null,
        extension: !!item.extension,
        situational: false,
        variants: [],
        children: [],
      };
      if (item.submenu && parentKey === null) {
        row.children = (
          await rowsOf(document.createXULElement("menupopup"), root, key, icons)
        ).filter((r) => !r.separator);
      }
      const after = list.findIndex(
        (r) => r.key && r.key === Z.canonicalKey(item.prev ?? ""),
      );
      if (after >= 0 && !item.extension) {
        list.splice(after + 1, 0, row);
      } else {
        list.push(row);
      }
      byKey.set(canonical, row);
    }
    for (const row of list) {
      if (row.variants) {
        row.variants = [...new Set(row.variants)].filter(
          (v) => v && v !== row.label,
        );
      }
    }
    return list;
  }

  async function catalog() {
    await loaded;
    const icons = await cssIcons();
    const menus = [];
    for (const def of Z.MENUS) {
      const popup = document.getElementById(def.id);
      if (!popup) {
        continue;
      }
      const rows = await rowsOf(popup, popup, null, icons);
      let groups;
      if (def.sections) {
        groups = Z.groupRows(def, rows);
      } else {
        // Items only some situations show (pinned tabs, several selected
        // tabs...) go last, so the list looks like the menu you know.
        groups = Z.groupRows(
          def,
          rows.filter((r) => r.separator || !r.situational),
        );
        const rare = rows.filter((r) => !r.separator && r.situational);
        if (rare.length) {
          groups.push({
            title: "Only in some situations",
            hint: "For pinned tabs or several selected tabs, or not used in Zen.",
            rows: rare,
            rare: true,
          });
        }
      }
      const snapshots = Object.entries(data.snapshots)
        .filter(([name]) => name === def.id || name.startsWith(`${def.id}/`))
        .map(([name, snap]) => ({
          context: name.split("/")[1] ?? null,
          at: snap.at,
          entries: snap.entries,
        }))
        .sort((a, b) => b.at - a.at);
      menus.push({
        id: def.id,
        name: def.name,
        hint: def.hint,
        groups,
        snapshots,
      });
    }
    return { menus };
  }

  /* ---------- opening the settings ---------- */

  function openSettings() {
    const existing = gBrowser.tabs.find(
      (tab) =>
        tab.linkedBrowser?.currentURI?.spec?.split("#")[0] === SETTINGS_URL,
    );
    gBrowser.selectedTab = existing ?? gBrowser.addTrustedTab(SETTINGS_URL);
  }

  // "Customize Context Menus…" in the sidebar's and toolbars' menu, under
  // "Customize Toolbar…". It's a menu item like any other, so it can be
  // hidden too; the settings button in Sine still opens the page.
  function addMenuItem() {
    const menu = document.getElementById("toolbar-context-menu");
    if (!menu) {
      return;
    }
    const item = document.createXULElement("menuitem");
    item.id = "toolbar-context-zcm-settings";
    item.setAttribute("label", "Customize Context Menus…");
    item.addEventListener("command", openSettings);
    const anchor = document.getElementById("toolbar-context-customize");
    if (anchor?.parentElement === menu) {
      anchor.after(item);
    } else {
      menu.append(item);
    }
    cleanups.push(() => item.remove());
  }

  // The settings button on this mod's card in Sine opens the settings page
  // instead of the basic options box.
  const hookedWindows = new Set();
  function onSineClick(e) {
    const button = e.target.closest?.(".sineItemConfigureButton");
    if (button?.closest(".sineItem")?.getAttribute("mod-id") === SINE_MOD_ID) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openSettings();
    }
  }
  function hookModCard(browser) {
    let win;
    try {
      win = browser.contentWindow;
    } catch {
      return;
    }
    if (
      !win ||
      hookedWindows.has(win) ||
      !/^about:(preferences|settings)/.test(String(win.location?.href))
    ) {
      return;
    }
    hookedWindows.add(win);
    win.addEventListener("click", onSineClick, true);
    win.addEventListener("unload", () => hookedWindows.delete(win), {
      once: true,
    });
  }

  /* ---------- wiring ---------- */

  function init() {
    setDefaultPrefs();
    migrateLegacyPrefs();
    readHidden();

    window.addEventListener("popupshowing", onPopupShowing);
    window.addEventListener("popupshown", onPopupShown);
    window.addEventListener("popuphidden", onPopupHidden);
    cleanups.push(() => {
      window.removeEventListener("popupshowing", onPopupShowing);
      window.removeEventListener("popupshown", onPopupShown);
      window.removeEventListener("popuphidden", onPopupHidden);
      for (const popup of [...states.keys()]) {
        restore(popup);
      }
    });

    // Hidden items changed (settings page, another window): menus that are
    // open right now update too.
    const prefObserver = {
      observe() {
        readHidden();
        for (const popup of states.keys()) {
          const root = rootMenuOf(popup);
          if (root) {
            apply(popup, root);
          }
        }
      },
    };
    Services.prefs.addObserver(Z.PREF_HIDDEN, prefObserver);
    cleanups.push(() =>
      Services.prefs.removeObserver(Z.PREF_HIDDEN, prefObserver),
    );

    addMenuItem();

    const progressListener = {
      onLocationChange(browser, webProgress) {
        if (webProgress?.isTopLevel) {
          hookModCard(browser);
        }
      },
      onStateChange(browser, webProgress, request, flags) {
        if (
          webProgress?.isTopLevel &&
          flags & Ci.nsIWebProgressListener.STATE_STOP
        ) {
          hookModCard(browser);
        }
      },
    };
    gBrowser.addTabsProgressListener(progressListener);
    gBrowser.browsers.forEach(hookModCard);
    cleanups.push(() => {
      gBrowser.removeTabsProgressListener(progressListener);
      for (const win of hookedWindows) {
        win.removeEventListener("click", onSineClick, true);
      }
      hookedWindows.clear();
    });

    // Don't lose what was seen in the last seconds before closing.
    const saveNow = () => saveTimer && save();
    window.addEventListener("unload", saveNow);
    cleanups.push(() => {
      window.removeEventListener("unload", saveNow);
      saveNow();
    });
  }

  function unload() {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (ex) {
        log(ex);
      }
    }
    if (window.ZenContextMenu === api) {
      delete window.ZenContextMenu;
    }
  }

  // Used by the settings page.
  const api = {
    catalog,
    openSettings,
    unload,
    settingsURL: SETTINGS_URL,
  };
  window.ZenContextMenu = api;

  // Lets Sine switch the mod off (or update it) without a restart.
  try {
    window.addUnloadListener?.(unload);
  } catch {
    // Not Sine, or an older one: switching the mod off needs a restart.
  }

  try {
    init();
  } catch (ex) {
    log(ex);
  }
})();
