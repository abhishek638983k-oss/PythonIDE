
/* =========================
   GLOBAL STATE
========================= */

let pyodide;
let editor;

let tabs = [];
let activeTab = 0;

let stdinResolver = null;

let autosaveInterval;

const terminal = document.getElementById("terminal");

/* =========================
   INIT PYODIDE
========================= */

async function initPyodideApp() {

    terminal.textContent = "Loading Python runtime...\n";

    pyodide = await loadPyodide();

    await pyodide.loadPackage("micropip");

    terminal.textContent += "Python Ready ✔\n";

    showStatus("Ready");

    startAutoSave();
}

initPyodideApp();

/* =========================
   MONACO INIT
========================= */

require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs"
    }
});

require(["vs/editor/editor.main"], function () {

    editor = monaco.editor.create(
        document.getElementById("editor"),
        {
            value: `print("Hello Python IDE")`,
            language: "python",
            theme: "vs-dark",
            automaticLayout: true
        }
    );

    tabs.push({
        name: "main.py",
        code: editor.getValue()
    });

    renderTabs();
    renderFiles();
});

/* =========================
   RUN CODE (WITH input())
========================= */

async function runCode() {

    if (!pyodide) return;

    terminal.textContent = "";

    saveCurrentTab();

    const code = editor.getValue();

    try {

        pyodide.setStdout({
            batched: (msg) => terminal.textContent += msg
        });

        pyodide.setStderr({
            batched: (msg) => terminal.textContent += msg
        });

        // input() override
        pyodide.globals.set("input", (promptText = "") => {

            terminal.textContent += promptText;

            return new Promise(resolve => {
                stdinResolver = resolve;
                openInputModal();
            });
        });

        await pyodide.runPythonAsync(code);

    } catch (err) {
        terminal.textContent += "\nError: " + err;
    }
}

/* =========================
   INPUT MODAL SYSTEM
========================= */

function openInputModal() {
    document.getElementById("inputModal").classList.remove("hidden");
}

function submitInput() {

    const val = document.getElementById("pythonInput").value;

    document.getElementById("pythonInput").value = "";

    document.getElementById("inputModal").classList.add("hidden");

    if (stdinResolver) {
        stdinResolver(val);
        stdinResolver = null;
    }
}

/* =========================
   PACKAGE INSTALLER (micropip)
========================= */

function installPackage() {
    document.getElementById("packageModal").classList.remove("hidden");
}

async function confirmInstallPackage() {

    const pkg = document.getElementById("packageName").value;

    document.getElementById("packageModal").classList.add("hidden");

    terminal.textContent += `\nInstalling ${pkg}...\n`;

    try {
        await pyodide.runPythonAsync(`
import micropip
await micropip.install("${pkg}")
        `);

        terminal.textContent += `${pkg} installed ✔\n`;

    } catch (e) {
        terminal.textContent += `Install failed: ${e}\n`;
    }
}

function closePackageModal() {
    document.getElementById("packageModal").classList.add("hidden");
}

/* =========================
   TABS SYSTEM (CLOSEABLE)
========================= */

function newTab() {

    tabs.push({
        name: `file${tabs.length + 1}.py`,
        code: ""
    });

    activeTab = tabs.length - 1;

    switchTab(activeTab);
}

function switchTab(index) {

    saveCurrentTab();

    activeTab = index;

    editor.setValue(tabs[index].code || "");

    renderTabs();
    renderFiles();
}

function closeTab(index) {

    tabs.splice(index, 1);

    if (tabs.length === 0) {
        newTab();
        return;
    }

    activeTab = Math.max(0, index - 1);

    switchTab(activeTab);
}

function renderTabs() {

    const tabBar = document.getElementById("tabs");

    tabBar.innerHTML = "";

    tabs.forEach((tab, i) => {

        const el = document.createElement("div");

        el.className = "tab" + (i === activeTab ? " active" : "");

        el.innerHTML = `
            ${tab.name}
            <span class="tab-close" onclick="closeTab(${i})">✖</span>
        `;

        el.onclick = () => switchTab(i);

        tabBar.appendChild(el);
    });
}

/* =========================
   FILE EXPLORER
========================= */

function renderFiles() {

    const box = document.getElementById("fileExplorer");

    box.innerHTML = "";

    tabs.forEach((t, i) => {

        const div = document.createElement("div");

        div.className = "file-item" + (i === activeTab ? " active" : "");

        div.textContent = t.name;

        div.onclick = () => switchTab(i);

        box.appendChild(div);
    });
}

/* =========================
   AUTO SAVE
========================= */

function startAutoSave() {

    autosaveInterval = setInterval(() => {

        saveCurrentTab();

        localStorage.setItem("py_ide_tabs", JSON.stringify(tabs));

        document.getElementById("autosaveStatus").textContent =
            "Auto-save: ON ✔";

    }, 3000);
}

function saveCurrentTab() {
    if (tabs[activeTab]) {
        tabs[activeTab].code = editor.getValue();
    }
}

/* =========================
   SAVE / LOAD
========================= */

function saveCode() {

    saveCurrentTab();

    localStorage.setItem("py_ide_tabs", JSON.stringify(tabs));

    showStatus("Saved ✔");
}

window.addEventListener("load", () => {

    const saved = localStorage.getItem("py_ide_tabs");

    if (saved) {

        tabs = JSON.parse(saved);

        setTimeout(() => {

            editor.setValue(tabs[0]?.code || "");

            renderTabs();
            renderFiles();

        }, 500);
    }
});

/* =========================
   THEME SWITCH
========================= */

function toggleTheme() {
    document.body.classList.toggle("light");
}

/* =========================
   TERMINAL
========================= */

function clearTerminal() {
    terminal.textContent = "";
}

/* =========================
   FORMAT CODE
========================= */

function formatCode() {

    const code = editor.getValue();

    const formatted = code
        .split("\n")
        .map(l => l.trimEnd())
        .join("\n");

    editor.setValue(formatted);
}

/* =========================
   FILE OPERATIONS
========================= */

function downloadFile() {

    const blob = new Blob([editor.getValue()], {
        type: "text/plain"
    });

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = tabs[activeTab]?.name || "code.py";

    a.click();
}

function uploadFile() {

    const input = document.getElementById("fileInput");

    input.click();

    input.onchange = function () {

        const file = input.files[0];

        const reader = new FileReader();

        reader.onload = e => {

            editor.setValue(e.target.result);

            tabs[activeTab].name = file.name;

            renderTabs();
            renderFiles();
        };

        reader.readAsText(file);
    };
}

/* =========================
   SHARE
========================= */

function shareCode() {

    const code = encodeURIComponent(editor.getValue());

    const url = location.origin + location.pathname + "?code=" + code;

    navigator.clipboard.writeText(url);

    alert("Share link copied!");
}

/* =========================
   SPLITTER RESIZE
========================= */

const splitter = document.getElementById("splitter");
const editorPane = document.getElementById("editor");
const terminalPane = document.getElementById("terminalPanel");

let isDragging = false;

splitter.addEventListener("mousedown", () => {
    isDragging = true;
});

window.addEventListener("mousemove", (e) => {

    if (!isDragging) return;

    const percent = (e.clientX / window.innerWidth) * 100;

    editorPane.style.width = percent + "%";
    terminalPane.style.width = (100 - percent) + "%";
});

window.addEventListener("mouseup", () => {
    isDragging = false;
});

/* =========================
   KEYBOARD SHORTCUTS
========================= */

window.addEventListener("keydown", (e) => {

    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveCode();
    }

    if (e.key === "F5") {
        e.preventDefault();
        runCode();
    }

    if (e.ctrlKey && e.key === "Enter") {
        runCode();
    }
});

/* =========================
   STATUS
========================= */

function showStatus(msg) {
    document.getElementById("status").textContent = msg;
}
