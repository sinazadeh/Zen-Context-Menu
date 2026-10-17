"use strict";

/* global ZenContextMenuShared */

/* ---------- connection to Zen ---------- */

const Z = ZenContextMenuShared;

const inZen = typeof Services !== "undefined";
const chromeWin = (() => {
  try {
    return window.browsingContext?.topChromeWindow ?? null;
  } catch {
    return null;
  }
})();
const api = chromeWin?.ZenContextMenu ?? null;

// Opened outside Zen (or before Zen was restarted after installing), the page
// shows sample data (sample.js) so it can still be looked at.
const SAMPLE_PREFS = new Map();

const prefs = inZen
  ? {
      getString: (name, fallback) =>
        Services.prefs.getStringPref(name, fallback),
      setString: (name, value) => Services.prefs.setStringPref(name, value),
      getBool: (name, fallback) => Services.prefs.getBoolPref(name, fallback),
      setBool: (name, value) => Services.prefs.setBoolPref(name, value),
      observe(branches, fn) {
        const observer = { observe: (_s, _t, name) => fn(name) };
        for (const branch of branches) {
          Services.prefs.addObserver(branch, observer);
        }
        window.addEventListener("unload", () => {
          for (const branch of branches) {
            Services.prefs.removeObserver(branch, observer);
          }
        });
      },
    }
  : {
      getString: (name, fallback) => SAMPLE_PREFS.get(name) ?? fallback,
      setString: (name, value) => SAMPLE_PREFS.set(name, value),
      getBool: (name, fallback) =>
        SAMPLE_PREFS.has(name) ? SAMPLE_PREFS.get(name) : fallback,
      setBool: (name, value) => SAMPLE_PREFS.set(name, value),
      observe() {},
    };

const isMac = inZen
  ? Services.appinfo.OS === "Darwin"
  : /Mac/.test(navigator.platform);

/* ---------- options ---------- */

// The style options of chrome.css (see preferences.json).
const OPTIONS = [
  {
    pref: "uc.fixcontext.ergonomicsfortabs",
    title: "Reorder the tab menu",
    text: "Tab actions first (split view, mute, Essentials, pin...), then moving and organizing, then everything else, then closing.",
  },
  {
    pref: "uc.hidecontext.copylink",
    title: "One Copy Link option",
    text: "Show “Copy Clean Link” when a link has tracking parameters to remove, and “Copy Link” when it doesn't, instead of both.",
  },
  {
    pref: "uc.fixcontext.restoreicons",
    title: "Icons for every option",
    text: "Show an icon next to each option, like Zen did before 1.12.9b.",
  },
  {
    pref: "uc.hidecontext.icons",
    title: "No icons",
    text: "Hide the icons menus show (extensions, containers...), except checkmarks.",
  },
  {
    pref: "uc.hidecontext.separators",
    title: "No separators",
    text: "Hide the lines between groups of options.",
  },
  {
    pref: "uc.fixcontext.applyzengradient",
    title: "Space gradient",
    text: "Paint menus and other pop-ups with your space's gradient.",
  },
  {
    pref: "uc.fixcontext.applyzenaccent",
    title: "Space color",
    text: "Tint menus and other pop-ups with your space's main color.",
  },
  {
    pref: "widget.macos.native-context-menus",
    invert: true,
    macOnly: true,
    title: "Zen's own menus on macOS",
    text: "macOS draws its own menus, which mods can't restyle. Hiding options works either way; the options above need Zen's menus. Switch this off again before removing the mod.",
  },
];

const optionValue = (option) => {
  const fallback = option.invert || Z.DEFAULT_ON.includes(option.pref);
  const value = prefs.getBool(option.pref, fallback);
  return option.invert ? !value : value;
};

/* ---------- helpers ---------- */

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") {
      el.className = value;
    } else if (key.startsWith("on")) {
      el.addEventListener(key.slice(2), value);
    } else if (key === "checked" || key === "disabled") {
      el[key] = !!value;
    } else if (value !== false && value != null) {
      el.setAttribute(key, value === true ? "" : value);
    }
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

function icon(src) {
  if (!src) {
    return null;
  }
  const img = h("img", { alt: "", src });
  // chrome:// icons don't load outside Zen; keep the space so labels line up.
  img.addEventListener("error", () => (img.style.visibility = "hidden"), {
    once: true,
  });
  return img;
}

function tagFor(source) {
  if (!source) {
    return null;
  }
  const kind =
    source === "Zen"
      ? "zen"
      : Z.MODS.some((mod) => mod.name === source)
        ? "mod"
        : "extension";
  return h("span", { class: `tag ${kind}` }, source);
}

const confirmDialog = document.getElementById("confirm");
function ask(text, okLabel) {
  document.getElementById("confirm-text").textContent = text;
  document.getElementById("confirm-ok").textContent = okLabel;
  confirmDialog.returnValue = "";
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmDialog.addEventListener(
      "close",
      () => resolve(confirmDialog.returnValue === "ok"),
      { once: true },
    );
  });
}

function ago(time) {
  const days = Math.floor((Date.now() - time) / 86400000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/* ---------- state ---------- */

let catalog = { menus: [] };
let hidden = Z.parseHidden(prefs.getString(Z.PREF_HIDDEN, "[]"));
let lastSaved = Z.serializeHidden(hidden);
let current = decodeURIComponent(location.hash.slice(1)) || "tabContextMenu";
let context = null;
let query = "";
// Submenus and "only in some situations" groups that are unfolded.
const unfolded = new Set();

function save() {
  lastSaved = Z.serializeHidden(hidden);
  prefs.setString(Z.PREF_HIDDEN, lastSaved);
}

const currentMenu = () =>
  catalog.menus.find((menu) => menu.id === current) ?? catalog.menus[0];

function* allRows(menu) {
  for (const group of menu.groups) {
    for (const row of group.rows) {
      yield row;
      yield* row.children;
    }
  }
}

const hiddenCount = (menu) =>
  [...allRows(menu)].filter((row) => hidden.has(row.key)).length;

function setHidden(key, hide) {
  if (hide) {
    hidden.add(key);
  } else {
    hidden.delete(key);
  }
  save();
  render({ focusKey: key });
}

/* ---------- item list ---------- */

const matches = (row) =>
  !query ||
  [row.label, ...row.variants, row.source ?? ""].some((text) =>
    text.toLowerCase().includes(query),
  );

function renderRow(row, parentOff = false, inRareGroup = false) {
  const off = hidden.has(row.key);
  const children = row.children.filter(
    (child) => !query || matches(row) || matches(child),
  );
  const open = children.length > 0 && (unfolded.has(row.key) || !!query);
  const toggle = h("input", {
    type: "checkbox",
    class: "switch",
    checked: !off,
    disabled: parentOff,
    "data-key": row.key,
    "aria-label": `Show “${row.label}”`,
    title: off ? "Hidden. Switch on to show it again." : "Shown",
    onchange: (e) => setHidden(row.key, !e.target.checked),
  });
  const main = h(
    "div",
    {
      class: "row-main",
      "data-key": row.key,
      onclick: (e) => {
        if (!e.target.closest("button, input") && !toggle.disabled) {
          toggle.click();
        }
      },
      onmouseenter: () => highlight(row.key, true),
      onmouseleave: () => highlight(row.key, false),
    },
    h("span", { class: "row-icon" }, icon(row.icon)),
    h(
      "span",
      { class: "row-text" },
      h(
        "span",
        { class: "row-label" },
        h("span", {}, row.label),
        tagFor(row.source),
      ),
      row.variants.length
        ? h("span", { class: "row-sub" }, `Also ${row.variants.join(", ")}`)
        : null,
    ),
    row.children.length
      ? h(
          "button",
          {
            type: "button",
            class: `disclose${open ? " open" : ""}`,
            "aria-expanded": String(open),
            title: open
              ? "Hide the submenu's items"
              : "Show the submenu's items",
            onclick: () => {
              if (unfolded.has(row.key)) {
                unfolded.delete(row.key);
              } else {
                unfolded.add(row.key);
              }
              render();
            },
          },
          `${row.children.length} inside`,
          h("span", { class: "chevron" }),
        )
      : h("span"),
    toggle,
  );
  return h(
    "li",
    {
      class: `row${off ? " off" : ""}${off && open ? " parent-off" : ""}${
        row.situational && !inRareGroup ? " rare" : ""
      }`,
      title:
        row.situational && !inRareGroup
          ? "Zen hasn't shown this item yet. It's only in some situations, or not used in Zen."
          : null,
    },
    main,
    open
      ? h(
          "ul",
          { class: "children" },
          children.map((child) =>
            renderRow(child, off || parentOff, inRareGroup),
          ),
        )
      : null,
  );
}

function renderGroups(menu) {
  const groups = [];
  let shownRows = 0;
  for (const group of menu.groups) {
    const rows = group.rows.filter(
      (row) => matches(row) || row.children.some(matches),
    );
    if (!rows.length) {
      continue;
    }
    shownRows += rows.length;
    const foldKey = `group:${menu.id}:${group.title}`;
    const folded = group.rare && !query && !unfolded.has(foldKey);
    const head = group.rare
      ? h(
          "button",
          {
            type: "button",
            class: `group-head${folded ? "" : " open"}`,
            "aria-expanded": String(!folded),
            onclick: () => {
              if (folded) {
                unfolded.add(foldKey);
              } else {
                unfolded.delete(foldKey);
              }
              render();
            },
          },
          h("h3", {}, `${group.title} (${rows.length})`),
          h("span", { class: "chevron" }),
          group.hint ? h("span", { class: "muted small" }, group.hint) : null,
        )
      : group.title
        ? h(
            "div",
            { class: "group-head" },
            h("h3", {}, group.title),
            group.hint ? h("span", { class: "muted small" }, group.hint) : null,
          )
        : null;
    groups.push(
      h(
        "div",
        { class: "group" },
        head,
        folded
          ? null
          : h(
              "ul",
              { class: "rows" },
              rows.map((row) => renderRow(row, false, !!group.rare)),
            ),
      ),
    );
  }
  document.getElementById("groups").replaceChildren(...groups);
  const noMatch = document.getElementById("no-match");
  noMatch.hidden = shownRows > 0;
  noMatch.textContent = query
    ? `Nothing in this menu matches “${query}”.`
    : "Zen hasn't shown this menu yet.";
}

function renderTabs() {
  document.getElementById("menu-tabs").replaceChildren(
    ...catalog.menus.map((menu) => {
      const count = hiddenCount(menu);
      return h(
        "button",
        {
          type: "button",
          class: "menu-tab",
          role: "tab",
          "aria-selected": String(menu.id === currentMenu()?.id),
          onclick: () => {
            current = menu.id;
            context = null;
            history.replaceState(null, "", `#${encodeURIComponent(menu.id)}`);
            render();
          },
        },
        menu.name,
        count
          ? h("span", { class: "count", title: `${count} hidden` }, count)
          : null,
      );
    }),
  );
}

/* ---------- preview ---------- */

// What the menu showed the last time it was opened (on this kind of target,
// for the page menu), or a guess from the list.
function previewSource(menu) {
  const snapshots = menu.snapshots ?? [];
  if (snapshots.length) {
    return snapshots.find((s) => s.context === context) ?? snapshots[0];
  }
  if (menu.id === "contentAreaContextMenu") {
    return null;
  }
  const entries = [];
  for (const group of menu.groups.filter((g) => !g.rare)) {
    if (entries.length) {
      entries.push({ separator: true });
    }
    for (const row of group.rows) {
      entries.push({
        key: row.key,
        label: row.label,
        icon: row.icon,
        submenu: row.children.length > 0,
      });
    }
  }
  return { context: null, at: null, entries };
}

function renderPreview() {
  const menu = currentMenu();
  const preview = document.getElementById("preview");
  const note = document.getElementById("preview-note");
  const contexts = document.getElementById("contexts");
  const count = menu ? hiddenCount(menu) : 0;
  document.getElementById("preview-count").textContent = count
    ? `${count} hidden`
    : "";
  const source = menu && previewSource(menu);
  if (!source) {
    preview.replaceChildren();
    contexts.hidden = true;
    note.textContent = menu
      ? "Right-click a page, a link or an image, then come back here to see the menu."
      : "";
    return;
  }

  // The page menu has one preview for each kind of thing you right-clicked.
  const snapshots = menu.snapshots ?? [];
  const withContext = snapshots.filter((s) => s.context);
  contexts.hidden = withContext.length === 0;
  if (withContext.length) {
    const order = Z.MENUS.find((m) => m.id === menu.id)?.contexts ?? [];
    withContext.sort(
      (a, b) => order.indexOf(a.context) - order.indexOf(b.context),
    );
    contexts.replaceChildren(
      ...withContext.map((snap) =>
        h(
          "button",
          {
            type: "button",
            class: snap === source ? "selected" : "",
            onclick: () => {
              context = snap.context;
              renderPreview();
            },
          },
          snap.context,
        ),
      ),
    );
  }

  const entries = source.entries.map((entry) => ({
    ...entry,
    key: entry.key && Z.canonicalKey(entry.key),
    visible: entry.separator || !hidden.has(Z.canonicalKey(entry.key)),
  }));
  const dropped = Z.separatorsToHide(entries);
  preview.replaceChildren(
    ...entries
      .filter((entry, i) => entry.visible && !dropped.has(i))
      .map((entry) =>
        entry.separator
          ? h("div", { class: "p-sep" })
          : entry.key === "#context-navigation"
            ? h(
                "div",
                {
                  class: "p-item p-nav",
                  "data-key": entry.key,
                  title: entry.label,
                  onmouseenter: () => highlight(entry.key, true),
                  onmouseleave: () => highlight(entry.key, false),
                },
                NAVIGATION_ICONS.map((src) => icon(src)),
              )
            : h(
                "div",
                {
                  class: `p-item${entry.disabled ? " disabled" : ""}`,
                  "data-key": entry.key,
                  onmouseenter: () => highlight(entry.key, true),
                  onmouseleave: () => highlight(entry.key, false),
                },
                icon(entry.icon) ?? h("span", { class: "p-blank" }),
                h("span", { class: "p-label" }, entry.label),
                entry.submenu ? h("span", { class: "chevron" }) : null,
              ),
      ),
  );
  if (!preview.children.length) {
    preview.append(
      h(
        "div",
        { class: "p-item disabled" },
        h("span", { class: "p-label" }, "Everything is hidden"),
      ),
    );
  }
  note.textContent = source.at
    ? `As it looked when you last right-clicked ${
        source.context ? `${articled(source.context)}` : "here"
      } (${ago(source.at)}), without the items you hide.`
    : "Open this menu once to see exactly what it shows.";
}

// The Back, Forward, Reload and Bookmark buttons on top of the page menu.
const NAVIGATION_ICONS = ["back", "forward", "reload", "bookmark-hollow"].map(
  (name) => `chrome://browser/skin/zen-icons/${name}.svg`,
);

const articled = (context) =>
  ({
    Page: "a page",
    Link: "a link",
    Image: "an image",
    Video: "a video",
    Selection: "selected text",
    "Text field": "a text field",
  })[context] ?? context.toLowerCase();

function highlight(key, on) {
  for (const el of document.querySelectorAll(
    `[data-key="${CSS.escape(key)}"]`,
  )) {
    if (el.matches(".row-main, .p-item")) {
      el.classList.toggle("highlight", on);
    }
  }
}

/* ---------- options ---------- */

function renderOptions() {
  document.getElementById("options").replaceChildren(
    ...OPTIONS.filter((option) => !option.macOnly || isMac).map((option) =>
      h(
        "label",
        { class: "option" },
        h(
          "span",
          { class: "option-text" },
          h("b", {}, option.title),
          h("span", { class: "muted" }, option.text),
        ),
        h("input", {
          type: "checkbox",
          class: "switch",
          checked: optionValue(option),
          onchange: (e) =>
            prefs.setBool(
              option.pref,
              option.invert ? !e.target.checked : e.target.checked,
            ),
        }),
      ),
    ),
  );
}

/* ---------- backup ---------- */

// The mod's own options; macOS's native-menus preference is the browser's
// and depends on the computer, so it isn't backed up.
const BACKUP_OPTIONS = OPTIONS.map((option) => option.pref).filter((pref) =>
  pref.startsWith("uc."),
);

function backupStatus(text, { error = false } = {}) {
  const status = document.getElementById("backup-status");
  status.textContent = text;
  status.classList.toggle("error", error);
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const backupName = () =>
  `calmer-context-menu-backup-${new Date().toISOString().slice(0, 10)}.json`;

// Where to save a backup, picked in Zen's Save dialog; null if cancelled.
// (A chrome:// page can't start a download with <a download>.)
function pickBackupFile(name) {
  const { nsIFilePicker } = Components.interfaces;
  const picker =
    Components.classes["@mozilla.org/filepicker;1"].createInstance(
      nsIFilePicker,
    );
  picker.init(
    window.browsingContext,
    "Export settings",
    nsIFilePicker.modeSave,
  );
  picker.defaultString = name;
  picker.defaultExtension = "json";
  picker.appendFilter("JSON", "*.json");
  return new Promise((resolve) =>
    picker.open((result) =>
      resolve(result === nsIFilePicker.returnCancel ? null : picker.file.path),
    ),
  );
}

async function exportBackup() {
  const options = Object.fromEntries(
    BACKUP_OPTIONS.map((pref) => [
      pref,
      prefs.getBool(pref, Z.DEFAULT_ON.includes(pref)),
    ]),
  );
  const text = Z.makeBackup(hidden, options);
  const name = backupName();
  const exported = `${plural(hidden.size, "hidden item")} and the appearance settings`;
  if (!inZen) {
    // The sample page, in an ordinary tab: a download.
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = h("a", { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    backupStatus(`Exported ${exported}.`);
    return;
  }
  let path;
  try {
    path = await pickBackupFile(name);
    if (!path) {
      return;
    }
    await IOUtils.writeUTF8(path, text);
  } catch (ex) {
    console.error("[Calmer Context Menu]", ex);
    backupStatus("The backup couldn't be saved.", { error: true });
    return;
  }
  backupStatus(`Exported ${exported} to ${PathUtils.filename(path)}.`);
}

async function importBackup(file) {
  let backup;
  try {
    if (file.size > Z.BACKUP_MAX_LENGTH) {
      throw new Error("This file is too big to be a backup.");
    }
    backup = Z.parseBackup(await file.text(), BACKUP_OPTIONS);
  } catch (ex) {
    backupStatus(ex.message, { error: true });
    return;
  }
  if (
    !(await ask(
      `Replace your settings with this backup? It hides ${plural(backup.hidden.size, "item")}${
        backup.options.size ? " and sets the appearance options" : ""
      }.`,
      "Import",
    ))
  ) {
    return;
  }
  hidden = backup.hidden;
  save();
  for (const [pref, value] of backup.options) {
    prefs.setBool(pref, value);
  }
  renderOptions();
  render();
  backupStatus(
    `Imported ${plural(hidden.size, "hidden item")}${
      backup.options.size ? " and the appearance settings" : ""
    }.`,
  );
}

document
  .getElementById("backup-export")
  .addEventListener("click", exportBackup);
const backupFile = document.getElementById("backup-file");
document
  .getElementById("backup-import")
  .addEventListener("click", () => backupFile.click());
backupFile.addEventListener("change", () => {
  const [file] = backupFile.files;
  // Picking the same file again must fire "change" again.
  backupFile.value = "";
  if (file) {
    importBackup(file);
  }
});

/* ---------- page ---------- */

function render({ focusKey } = {}) {
  const menu = currentMenu();
  renderTabs();
  document.getElementById("menu-name").textContent = menu?.name ?? "";
  document.getElementById("menu-hint").textContent = menu?.hint ?? "";
  document.getElementById("show-all").disabled =
    !menu || hiddenCount(menu) === 0;
  document.getElementById("suggest").hidden =
    hidden.size > 0 || !catalog.menus.length;
  if (menu) {
    renderGroups(menu);
  }
  renderPreview();
  if (focusKey) {
    document
      .querySelector(`input.switch[data-key="${CSS.escape(focusKey)}"]`)
      ?.focus();
  }
}

async function refresh() {
  if (!api) {
    return;
  }
  try {
    catalog = await api.catalog();
  } catch (ex) {
    console.error("[Calmer Context Menu]", ex);
  }
  render();
}

function loadSample() {
  const script = document.createElement("script");
  script.src = "sample.js";
  script.addEventListener("load", () => {
    const sample = window.ZenContextMenuSample;
    SAMPLE_PREFS.set(Z.PREF_HIDDEN, JSON.stringify(sample.hidden ?? []));
    hidden = Z.parseHidden(prefs.getString(Z.PREF_HIDDEN, "[]"));
    lastSaved = Z.serializeHidden(hidden);
    catalog = sample;
    render();
  });
  document.head.append(script);
}

document.getElementById("filter").addEventListener("input", (e) => {
  query = e.target.value.trim().toLowerCase();
  render();
});

document.getElementById("show-all").addEventListener("click", async () => {
  const menu = currentMenu();
  const keys = [...allRows(menu)]
    .map((row) => row.key)
    .filter((key) => hidden.has(key));
  if (
    keys.length &&
    (await ask(
      `Show the ${keys.length} hidden item${keys.length === 1 ? "" : "s"} in the ${menu.name} menu again?`,
      "Show all",
    ))
  ) {
    keys.forEach((key) => hidden.delete(key));
    save();
    render();
  }
});

document.getElementById("suggest-apply").addEventListener("click", () => {
  Z.SUGGESTED.forEach((key) => hidden.add(Z.canonicalKey(key)));
  save();
  render();
});

// Changes made elsewhere (another settings tab, a backup restored by hand).
prefs.observe(
  ["uc.hidecontext.", "uc.fixcontext.", "widget.macos.native-context-menus"],
  (name) => {
    if (name === Z.PREF_HIDDEN) {
      if (prefs.getString(Z.PREF_HIDDEN, "[]") !== lastSaved) {
        hidden = Z.parseHidden(prefs.getString(Z.PREF_HIDDEN, "[]"));
        lastSaved = Z.serializeHidden(hidden);
        render();
      }
    } else {
      renderOptions();
    }
  },
);

// Menus opened since the page was: their items may be new.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refresh();
  }
});

document.getElementById("sample-note").hidden = !!api;
renderOptions();
render();
if (api) {
  refresh();
} else {
  loadSample();
}
