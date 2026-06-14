/* =========================
   GLOBAL STATE
========================= */

let pyodide;
let editor;
let currentTab = "main";

let tabs = {
  main: {
    name: "main.py",
    code: `print("Hello from Python IDE")`,
  },
};

/* =========================
   TERMINAL
========================= */

const terminal = document.getElementById("terminal");

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
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: tabs[currentTab].code,
    language: "python",
    theme: "vs-dark",
    automaticLayout: true,
  });
});

/* =========================
   RUN CODE
========================= */

async function runCode() {
  terminal.textContent = "";

  const code = editor.getValue();
  tabs[currentTab].code = code;

  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    terminal.textContent += "\nError: " + err;
  }
}

/* =========================
   THEME
========================= */

function toggleTheme() {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
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
  editor.trigger("keyboard", "undo");
}

function redo() {
  editor.trigger("keyboard", "redo");
}

/* =========================
   FORMAT CODE
========================= */

function formatCode() {
  editor.getAction("editor.action.formatDocument").run();
}

/* =========================
   SAVE / LOCAL STORAGE
========================= */

function saveCode() {
  tabs[currentTab].code = editor.getValue();
  localStorage.setItem("pyide_tabs", JSON.stringify(tabs));
  localStorage.setItem("pyide_current", currentTab);

  document.getElementById("status").textContent = "Saved ✔";
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
  renderFileExplorer();
}

/* =========================
   FILE EXPLORER
========================= */

function renderFileExplorer() {
  const explorer = document.getElementById("fileExplorer");
  explorer.innerHTML = "";

  Object.keys(tabs).forEach((id) => {
    const div = document.createElement("div");
    div.className = "file";

    div.textContent = tabs[id].name;

    if (id === currentTab) div.style.fontWeight = "bold";

    div.onclick = () => switchTab(id);

    explorer.appendChild(div);
  });
}

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

  document.getElementById("status").textContent = "Link copied ✔";
}

/* =========================
   INSTALL PACKAGE (Pyodide micropip)
========================= */

async function installPackage() {
  const name = prompt("Enter package name:");

  if (!name) return;

  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");

  try {
    await micropip.install(name);
    alert(`${name} installed ✔`);
  } catch (err) {
    alert("Install failed: " + err);
  }
}

/* =========================
   OPTIONAL: RESTORE ON LOAD
========================= */

window.onload = () => {
  loadSaved();
};
