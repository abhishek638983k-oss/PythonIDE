/* =========================
   PYODIDE + EDITOR
========================= */

let pyodide;
let editor;

const terminal = document.getElementById("terminal");

/* =========================
   INPUT QUEUE (SAFE)
========================= */

let inputQueue = [];

function pushInput(value) {
  inputQueue.push(value);
}

/* =========================
   PYTHON SAFE INPUT PATCH
========================= */

async function initPyodideApp() {
  terminal.textContent = "Loading Python...\n";

  pyodide = await loadPyodide();

  // 🔥 SAFE input() override (NO async blocking)
  pyodide.globals.set("input", (prompt = "") => {
    terminal.textContent += prompt;

    // if no input available → return empty string safely
    if (inputQueue.length === 0) {
      return "";
    }

    return inputQueue.shift();
  });

  terminal.textContent += "Python Ready ✔\n";
}

initPyodideApp();

/* =========================
   RUN CODE (SAFE)
========================= */

async function runCode() {
  terminal.textContent = "";

  const code = editor.getValue();

  try {
    pyodide.setStdout({
      batched: (msg) => (terminal.textContent += msg),
    });

    pyodide.setStderr({
      batched: (msg) => (terminal.textContent += msg),
    });

    await pyodide.runPythonAsync(code);
  } catch (err) {
    terminal.textContent += "\nError: " + err;
  }
}

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
    value: `print("Safe Pyodide IDE")`,
    language: "python",
    theme: "vs-dark",
    automaticLayout: true,
  });
});

/* =========================
   OPTIONAL SIMPLE INPUT BOX
   (non-blocking)
========================= */

function submitInput() {
  const val = document.getElementById("pythonInput").value;

  document.getElementById("pythonInput").value = "";

  pushInput(val);

  document.getElementById("inputModal").classList.add("hidden");
}

function openInputModal() {
  document.getElementById("inputModal").classList.remove("hidden");
}

/* =========================
   UTILS
========================= */

function clearTerminal() {
  terminal.textContent = "";
}
