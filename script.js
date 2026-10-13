/* =========================
   GLOBAL STATE
========================= */

let pyodide;
let editor;
let currentTab = "main";
let stdinBytes = new Uint8Array();
let stdinOffset = 0;
let isRunning = false;
let renamingTab = null;
let activeTheme = localStorage.getItem("pyide_theme") === "light" ? "light" : "dark";
let autoSaveEnabled = localStorage.getItem("pyide_autosave") !== "false";
let autoSaveTimer;
let filesPanelVisible = false;

let tabs = {
  main: {
    name: "main.py",
    code: `print("Hello from Python IDE")`,
  },
};

loadSaved();

/* =========================
   TERMINAL
========================= */

const terminal = document.getElementById("terminal");

/* =========================
   PROGRAM INPUT SHORTCUTS
========================= */

const programInput = document.getElementById("programInput");
const randomLetters = "abcdefghijklmnopqrstuvwxyz";

programInput.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "g") {
    event.preventDefault();
    generateProgramInput();
  }
});

function generateProgramInput() {
  const shortcutPattern = /^\/(\d+)(ll|[nfdsbhcl])$/i;
  const parts = programInput.value.split(/(\s+)/);
  const shortcuts = parts.filter((part) => shortcutPattern.test(part));

  const invalidShortcut = shortcuts.find((part) => {
    const count = Number(part.match(shortcutPattern)[1]);
    return !Number.isSafeInteger(count) || count < 1 || count > 1000;
  });
  if (invalidShortcut) {
    setStatus(`Shortcut count must be between 1 and 1000: ${invalidShortcut}`, "fa-triangle-exclamation");
    return;
  }

  let replaced = 0;

  const generatedParts = parts.map((part) => {
    const match = part.match(shortcutPattern);
    if (!match) return part;

    const count = Number(match[1]);
    const values = Array.from({ length: count }, () => {
      switch (match[2].toLowerCase()) {
        case "n":
          return String(Math.floor(Math.random() * 100) + 1);
        case "f":
          return (Math.random() * 100).toFixed(2);
        case "d":
          return (Math.random() * 100).toFixed(6);
        case "l":
          return String(Math.floor(Math.random() * 1_000_000) + 1);
        case "ll":
          return String(Math.floor(Math.random() * 1_000_000_000_000) + 1);
        case "h":
          return String(Math.floor(Math.random() * 65_536) - 32_768);
        case "b":
          return Math.random() < 0.5 ? "0" : "1";
        case "s":
          return Array.from(
            { length: 5 },
            () => randomLetters[Math.floor(Math.random() * randomLetters.length)],
          ).join("");
        case "c":
          return randomLetters[Math.floor(Math.random() * randomLetters.length)];
      }
    });

    replaced += 1;
    return values.join(" ");
  });

  if (replaced === 0) {
    setStatus(
      "No shortcuts found. Try /3n, /4f, /4d, /2ll, /3h, /3b, /4s, or /4c",
      "fa-circle-info",
    );
    return;
  }

  programInput.value = generatedParts.join("");
  programInput.dispatchEvent(new Event("input", { bubbles: true }));
  setStatus(`Generated values for ${replaced} shortcut${replaced === 1 ? "" : "s"}`, "fa-wand-magic-sparkles");
}

function clearInputBox() {
  programInput.value = "";
  programInput.focus();
  setStatus("Program input cleared", "fa-eraser");
}

/* =========================
   KEYBOARD SHORTCUTS
========================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
    closeFilesPanel();
    if (!document.getElementById("helpModal").classList.contains("hidden")) {
      closeHelp();
    } else if (!document.getElementById("renameModal").classList.contains("hidden")) {
      closeRenameModal();
    } else if (!document.getElementById("packageModal").classList.contains("hidden")) {
      closePackageModal();
    }
    return;
  }

  if (event.altKey && event.shiftKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    formatCode();
    return;
  }

  if (!event.ctrlKey && !event.metaKey) return;

  const key = event.key.toLowerCase();
  const editingTextField =
    event.target instanceof HTMLElement &&
    event.target.closest("input, textarea, [contenteditable='true']") &&
    !event.target.closest(".monaco-editor");

  if ((key === "z" || key === "y") && editingTextField) return;

  let action;
  if (key === "r" && event.shiftKey) action = () => renameTab(currentTab);
  else if (key === "r") action = runCode;
  else if (key === "s" && event.shiftKey) action = downloadFile;
  else if (key === "s") action = saveCode;
  else if (key === "z") action = undo;
  else if (key === "y") action = redo;
  else if (key === "i") action = uploadFile;
  else if (key === "c" && event.shiftKey) action = shareCode;
  else if (key === "p") action = installPackage;
  else return;

  event.preventDefault();
  action();
});

function openHelp() {
  document.getElementById("helpModal").classList.remove("hidden");
  document.getElementById("helpBox").focus();
}

function closeHelp() {
  document.getElementById("helpModal").classList.add("hidden");
}

function toggleMobileMenu() {
  const isOpen = document.body.classList.toggle("mobile-menu-open");
  const toggle = document.getElementById("mobileMenuToggle");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close actions menu" : "Open actions menu");
  toggle.title = isOpen ? "Close actions menu" : "Open actions menu";
  toggle.innerHTML = `<i class="fa-solid ${isOpen ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>`;
  backdrop.classList.toggle("hidden", !isOpen);
}

function closeMobileMenu() {
  if (!document.body.classList.contains("mobile-menu-open")) return;
  document.body.classList.remove("mobile-menu-open");
  const toggle = document.getElementById("mobileMenuToggle");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open actions menu");
  toggle.title = "Open actions menu";
  toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
  document.getElementById("mobileMenuBackdrop").classList.add("hidden");
}

document.getElementById("controls").addEventListener("click", (event) => {
  if (event.target.closest("button")) closeMobileMenu();
});

function toggleFilesPanel() {
  filesPanelVisible = !filesPanelVisible;
  closeMobileMenu();
  updateFilesToggle();
}

function closeFilesPanel() {
  if (!filesPanelVisible) return;
  filesPanelVisible = false;
  updateFilesToggle();
}

function updateFilesToggle() {
  document.body.classList.toggle("files-drawer-open", filesPanelVisible);
  document.getElementById("sidebar").classList.toggle("files-drawer-open", filesPanelVisible);

  const label = filesPanelVisible ? "Close files" : "Open files";
  const toggle = document.getElementById("mobileFileToggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(filesPanelVisible));
    const currentName = tabs[currentTab]?.name;
    toggle.title = currentName ? `${currentName} — ${label}` : label;
    toggle.setAttribute(
      "aria-label",
      currentName ? `${label} for ${currentName}` : label,
    );
    toggle.querySelector("i").className =
      `fa-solid ${filesPanelVisible ? "fa-chevron-up" : "fa-chevron-down"}`;
  }

  const menuButton = document.getElementById("filesToggle");
  if (menuButton) {
    menuButton.setAttribute("aria-expanded", String(filesPanelVisible));
    menuButton.innerHTML = `<i class="fa-solid fa-folder-open" aria-hidden="true"></i> ${label}`;
  }

  document.getElementById("filesDrawerBackdrop").classList.toggle("hidden", !filesPanelVisible);
}

function updateCurrentFileHeader() {
  const currentFileName = document.getElementById("currentFileName");
  if (currentFileName && tabs[currentTab]) {
    const name = tabs[currentTab].name;
    currentFileName.textContent = name;
    document.getElementById("mobileFileToggle").title =
      `${name} — ${filesPanelVisible ? "Close" : "Open"} files`;
    document.getElementById("mobileFileToggle").setAttribute(
      "aria-label",
      `${filesPanelVisible ? "Close" : "Open"} files for ${name}`,
    );
  }
}

updateFilesToggle();

/* =========================
   SELECTED TEXT SEARCH
========================= */

const selectionActions = document.getElementById("selectionActions");
const searchSelection = document.getElementById("searchSelection");

function updateSelectionActions(event) {
  const activeElement = event?.target instanceof HTMLInputElement ||
    event?.target instanceof HTMLTextAreaElement
    ? event.target
    : document.activeElement;
  let selectedText = "";
  let selectionRect;

  if (activeElement instanceof HTMLElement && activeElement.closest(".monaco-editor") && editor) {
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (selection && model && !selection.isEmpty()) {
      selectedText = model.getValueInRange(selection).trim();
      const position = editor.getScrolledVisiblePosition({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      });
      const editorRect = editor.getDomNode().getBoundingClientRect();
      if (position) {
        selectionRect = {
          left: editorRect.left + position.left,
          top: editorRect.top + position.top,
          bottom: editorRect.top + position.top + position.height,
        };
      }
    }
  } else if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
  ) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    if (start !== null && end !== null && end > start) {
      selectedText = activeElement.value.slice(start, end).trim();
      selectionRect = activeElement.getBoundingClientRect();
    }
  } else {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      selectedText = selection.toString().trim();
      selectionRect = selection.getRangeAt(0).getBoundingClientRect();
    }
  }

  if (!selectedText || !selectionRect) {
    selectionActions.classList.add("hidden");
    return;
  }

  searchSelection.href = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`;
  selectionActions.classList.remove("hidden");

  const bounds = selectionActions.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(selectionRect.left, window.innerWidth - bounds.width - 8),
  );
  const top =
    selectionRect.top >= bounds.height + 12
      ? selectionRect.top - bounds.height - 8
      : selectionRect.bottom + 8;
  selectionActions.style.left = `${left}px`;
  selectionActions.style.top = `${Math.min(top, window.innerHeight - bounds.height - 8)}px`;
}

document.addEventListener("selectionchange", (event) => {
  requestAnimationFrame(() => updateSelectionActions(event));
});
document.addEventListener("mouseup", (event) => updateSelectionActions(event));
document.addEventListener("keyup", (event) => updateSelectionActions(event));
document.addEventListener("pointerdown", (event) => {
  if (!selectionActions.contains(event.target)) {
    selectionActions.classList.add("hidden");
  }
});

/* =========================
   INIT PYODIDE
========================= */

async function initPyodideApp() {
  document.getElementById("loading").classList.remove("hidden");

  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
  });

  pyodide.setStdout({
    batched: (msg) => (terminal.textContent += msg),
  });

  pyodide.setStderr({
    batched: (msg) => (terminal.textContent += msg),
  });

  pyodide.setStdin({
    stdin: () => {
      if (stdinOffset >= stdinBytes.length) return null;
      return stdinBytes[stdinOffset++];
    },
  });

  document.getElementById("loading").classList.add("hidden");
  renderFileExplorer();
}

initPyodideApp();

/* =========================
   MONACO EDITOR
========================= */

require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs",
  },
});

require(["vs/editor/editor.main"], function () {
  monaco.editor.defineTheme("github-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" },
      { token: "type", foreground: "ffa657" },
      { token: "type.identifier", foreground: "ffa657" },
      { token: "function", foreground: "d2a8ff" },
      { token: "identifier", foreground: "e6edf3" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#e6edf3",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#e6edf3",
      "editor.lineHighlightBackground": "#161b22",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#30363d",
      "editorCursor.foreground": "#e6edf3",
      "editorIndentGuide.background": "#21262d",
      "editorIndentGuide.activeBackground": "#6e7681",
      "editorWidget.background": "#161b22",
      "editorWidget.border": "#30363d",
      "editorSuggestWidget.background": "#161b22",
      "editorSuggestWidget.border": "#30363d",
      "editorSuggestWidget.selectedBackground": "#21262d",
    },
  });

  monaco.editor.defineTheme("github-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e7781", fontStyle: "italic" },
      { token: "keyword", foreground: "cf222e" },
      { token: "string", foreground: "0a3069" },
      { token: "number", foreground: "0550ae" },
      { token: "type", foreground: "953800" },
      { token: "type.identifier", foreground: "953800" },
      { token: "function", foreground: "8250df" },
      { token: "identifier", foreground: "1f2328" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1f2328",
      "editorLineNumber.foreground": "#8c959f",
      "editorLineNumber.activeForeground": "#1f2328",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editor.selectionBackground": "#add6ff",
      "editor.inactiveSelectionBackground": "#e5ebf1",
      "editorCursor.foreground": "#1f2328",
      "editorIndentGuide.background": "#d8dee4",
      "editorIndentGuide.activeBackground": "#8c959f",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#d1d9e0",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#d1d9e0",
      "editorSuggestWidget.selectedBackground": "#f6f8fa",
    },
  });

  applyTheme(activeTheme);
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: tabs[currentTab].code,
    language: "python",
    theme: activeTheme === "dark" ? "github-dark" : "github-light",
    automaticLayout: true,
  });
  editor.onDidChangeModelContent(() => {
    tabs[currentTab].code = editor.getValue();
    scheduleAutoSave();
  });
  updateAutoSaveButton();
  updateCurrentFileHeader();
});

/* =========================
   RUN CODE
========================= */

async function runCode() {
  if (isRunning || !pyodide || !editor) return;

  isRunning = true;
  terminal.textContent = "";

  const code = editor.getValue();
  tabs[currentTab].code = code;
  const inputValues = document
    .getElementById("programInput")
    .value.trim()
    .split(/\s+/)
    .filter(Boolean);
  stdinBytes = new TextEncoder().encode(
    inputValues.length ? `${inputValues.join("\n")}\n` : "",
  );
  stdinOffset = 0;

  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    terminal.textContent += "\nError: " + err;
  } finally {
    isRunning = false;
  }
}

/* =========================
   THEME
========================= */

function toggleTheme() {
  applyTheme(activeTheme === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  activeTheme = theme;
  document.body.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("light", theme === "light");
  localStorage.setItem("pyide_theme", theme);

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const icon = theme === "dark" ? "fa-sun" : "fa-moon";
    const label = theme === "dark" ? "Light theme" : "Dark theme";
    themeToggle.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${label}`;
  }

  if (typeof monaco !== "undefined") {
    monaco.editor.setTheme(`github-${theme}`);
  }
}

/* =========================
   CLEAR TERMINAL
========================= */

function clearTerminal() {
  terminal.textContent = "";
}

/* =========================
   UNDO / REDO
========================= */

function undo() {
  if (!editor) return;
  editor.trigger("keyboard", "undo");
}

function redo() {
  if (!editor) return;
  editor.trigger("keyboard", "redo");
}

/* =========================
   FORMAT CODE
========================= */

function formatCode() {
  if (!editor) return;
  editor.getAction("editor.action.formatDocument").run();
}

/* =========================
   SAVE / LOCAL STORAGE
========================= */

function saveCode() {
  if (editor) tabs[currentTab].code = editor.getValue();
  persistWorkspace();
  setStatus("Saved", "fa-circle-check");
}

function persistWorkspace() {
  localStorage.setItem("pyide_tabs", JSON.stringify(tabs));
  localStorage.setItem("pyide_current", currentTab);
}

function scheduleAutoSave() {
  if (!autoSaveEnabled) return;

  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    persistWorkspace();
    setStatus("Auto-saved", "fa-cloud-arrow-up");
  }, 400);
}

function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  localStorage.setItem("pyide_autosave", String(autoSaveEnabled));
  updateAutoSaveButton();

  if (autoSaveEnabled) {
    persistWorkspace();
    setStatus("Auto-save enabled", "fa-cloud-arrow-up");
  } else {
    clearTimeout(autoSaveTimer);
    setStatus("Auto-save disabled", "fa-cloud-arrow-down");
  }
}

function updateAutoSaveButton() {
  const button = document.getElementById("autosaveToggle");
  if (!button) return;

  button.setAttribute("aria-pressed", String(autoSaveEnabled));
  button.innerHTML = autoSaveEnabled
    ? '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Auto-save: ON'
    : '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i> Auto-save: OFF';
}

function setStatus(message, icon) {
  const status = document.getElementById("status");
  status.replaceChildren();

  const iconElement = document.createElement("i");
  iconElement.className = `fa-solid ${icon}`;
  iconElement.setAttribute("aria-hidden", "true");
  status.append(iconElement, document.createTextNode(` ${message}`));
}

/* =========================
   LOAD SAVE
========================= */

function loadSaved() {
  const saved = localStorage.getItem("pyide_tabs");
  const current = localStorage.getItem("pyide_current");

  if (saved) tabs = JSON.parse(saved);
  if (current) currentTab = current;
}

/* =========================
   NEW TAB
========================= */

function newTab() {
  const id = "tab_" + Date.now();

  tabs[id] = {
    name: `file_${Object.keys(tabs).length}.py`,
    code: "",
  };

  switchTab(id);
  renderFileExplorer();
}

/* =========================
   SWITCH TAB
========================= */

function switchTab(id) {
  tabs[currentTab].code = editor.getValue();

  currentTab = id;
  editor.setValue(tabs[id].code);
  if (autoSaveEnabled) persistWorkspace();
  renderFileExplorer();
  updateCurrentFileHeader();
  closeFilesPanel();
}

/* =========================
   FILE EXPLORER
========================= */

function renderFileExplorer() {
  const explorer = document.getElementById("fileExplorer");
  explorer.innerHTML = "";

  Object.keys(tabs).forEach((id) => {
    const row = document.createElement("div");
    row.className = "file-row";
    if (id === currentTab) row.classList.add("active");

    const name = document.createElement("button");
    name.type = "button";
    name.className = "file-name";
    name.title = tabs[id].name;
    name.onclick = () => switchTab(id);

    const fileIcon = document.createElement("i");
    fileIcon.className = "fa-solid fa-file-code";
    fileIcon.setAttribute("aria-hidden", "true");
    name.append(fileIcon, document.createTextNode(` ${tabs[id].name}`));

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "file-rename";
    rename.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i> Rename';
    rename.title = `Rename ${tabs[id].name} (Ctrl+Shift+R for current file)`;
    rename.setAttribute("aria-label", `Rename ${tabs[id].name}`);
    rename.onclick = (event) => {
      event.stopPropagation();
      renameTab(id);
    };

    row.append(name, rename);
    explorer.appendChild(row);
  });
  updateCurrentFileHeader();
}

function renameTab(id) {
  renamingTab = id;
  const input = document.getElementById("renameName");
  input.value = tabs[id].name;
  document.getElementById("renameModal").classList.remove("hidden");
  input.onkeydown = (event) => {
    if (event.key === "Enter") confirmRenameTab();
    if (event.key === "Escape") closeRenameModal();
  };
  input.focus();
  input.select();
}

function closeRenameModal() {
  document.getElementById("renameModal").classList.add("hidden");
  renamingTab = null;
}

function confirmRenameTab() {
  if (!renamingTab) return;

  const newName = document.getElementById("renameName").value.trim();
  if (!newName) {
    document.getElementById("status").textContent = "File name cannot be empty";
    return;
  }

  const duplicate = Object.keys(tabs).some(
    (tabId) =>
      tabId !== renamingTab &&
      tabs[tabId].name.toLowerCase() === newName.toLowerCase(),
  );
  if (duplicate) {
    document.getElementById("status").textContent =
      "A file with that name already exists";
    return;
  }

  tabs[renamingTab].name = newName;
  persistWorkspace();
  renderFileExplorer();
  updateCurrentFileHeader();
  closeRenameModal();
  setStatus("File renamed", "fa-circle-check");
}

/* =========================
   RESIZABLE PANELS
========================= */

function setupResizablePanels() {
  const container = document.getElementById("container");
  const editor = document.getElementById("editor");
  const terminalPanel = document.getElementById("terminalPanel");
  const editorSplitter = document.getElementById("splitter");
  const inputSplitter = document.getElementById("inputSplitter");

  function startResize(event, onMove, cursor) {
    if (event.button !== 0) return;
    event.preventDefault();
    const move = (moveEvent) => onMove(moveEvent);
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
      document.body.classList.remove("resizing");
      document.body.style.removeProperty("--resize-cursor");
    };
    document.body.style.setProperty("--resize-cursor", cursor);
    document.body.classList.add("resizing");
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
    document.addEventListener("pointercancel", stop, { once: true });
  }

  editorSplitter.addEventListener("pointerdown", (event) => {
    startResize(event, (moveEvent) => {
      const bounds = container.getBoundingClientRect();
      const vertical = window.matchMedia("(max-width: 900px)").matches;
      const available = vertical ? bounds.height : bounds.width;
      const position = vertical
        ? moveEvent.clientY - bounds.top
        : moveEvent.clientX - bounds.left;
      const minEditor = Math.min(220, available * 0.3);
      const splitterSize = vertical
        ? editorSplitter.offsetHeight
        : editorSplitter.offsetWidth;
      const maxEditor = available - minEditor - splitterSize;
      const size = Math.max(minEditor, Math.min(maxEditor, position));
      editor.style.flexBasis = `${size}px`;
    }, window.matchMedia("(max-width: 900px)").matches ? "row-resize" : "col-resize");
  });

  inputSplitter.addEventListener("pointerdown", (event) => {
    startResize(event, (moveEvent) => {
      const bounds = terminalPanel.getBoundingClientRect();
      const available = bounds.height - inputSplitter.offsetHeight;
      const inputHeight = bounds.bottom - moveEvent.clientY;
      const minPanel = Math.min(100, available * 0.25);
      const size = Math.max(minPanel, Math.min(available - minPanel, inputHeight));
      document.getElementById("programInputPanel").style.flexBasis =
        `${size}px`;
    }, "row-resize");
  });
}

setupResizablePanels();

/* =========================
   DOWNLOAD FILE
========================= */

function downloadFile() {
  const blob = new Blob([editor.getValue()], {
    type: "text/python",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = tabs[currentTab].name;
  a.click();
}

/* =========================
   UPLOAD FILE
========================= */

function uploadFile() {
  const input = document.getElementById("fileInput");

  input.onchange = (e) => {
    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = function () {
      editor.setValue(reader.result);
    };

    reader.readAsText(file);
  };

  input.click();
}

/* =========================
   SHARE CODE (URL)
========================= */

function shareCode() {
  const code = encodeURIComponent(editor.getValue());

  const url = `${location.origin}${location.pathname}?code=${code}`;

  navigator.clipboard.writeText(url);

  setStatus("Link copied", "fa-circle-check");
}

/* =========================
   INSTALL PACKAGE (Pyodide micropip)
========================= */

async function installPackage() {
  document.getElementById("packageModal").classList.remove("hidden");
  const packageName = document.getElementById("packageName");
  packageName.onkeydown = (event) => {
    if (event.key === "Enter") confirmInstallPackage();
  };
  packageName.focus();
}

function closePackageModal() {
  document.getElementById("packageModal").classList.add("hidden");
}

async function confirmInstallPackage() {
  const name = document.getElementById("packageName").value.trim();
  if (!name) {
    setStatus("Enter a package name", "fa-triangle-exclamation");
    return;
  }
  if (!pyodide) {
    setStatus("Python runtime is still loading", "fa-triangle-exclamation");
    return;
  }

  closePackageModal();
  setStatus(`Installing ${name}...`, "fa-spinner fa-spin");
  try {
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(name);
    setStatus(`${name} installed`, "fa-circle-check");
  } catch (err) {
    terminal.textContent += `\nPackage install failed: ${err}`;
    setStatus(`Failed to install ${name}`, "fa-triangle-exclamation");
  }
}

/* =========================
   OPTIONAL: RESTORE ON LOAD
========================= */
