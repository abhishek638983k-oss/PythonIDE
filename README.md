# PythonIDE
A browser-based Python IDE that runs code using Pyodide (no backend needed). Features include Monaco Editor with syntax highlighting, autocomplete, multiple tabs, undo/redo, auto-save, file open/download, shareable links, real-time output, pre-run program input for Python `input()` calls, error highlighting, and Black-based code formatting.

Enter program input in the box below the terminal before running code. Separate values with spaces or newlines; each call to `input()` consumes the next value.

Rename a file with the Rename button beside its name in the file list. Drag the divider between the editor and output column to resize them, or drag the divider between output and input to adjust their heights.

Use the theme button to switch between GitHub-inspired dark and light themes. The selected theme, including the editor syntax colors, is saved across reloads.

The program input field supports manual random-value shortcuts. Enter `/countType` and click **Generate** or press **Ctrl+G** while focused in the input box. Shortcuts are expanded in place and are not generated automatically when running code:

- `n`: integer from 1 to 100; `f`: decimal with two places from 0 to 100
- `d`: decimal with six places from 0 to 100
- `h`: short integer from -32,768 to 32,767
- `l`: long integer from 1 to 1,000,000; `ll`: long-long integer from 1 to 1,000,000,000,000
- `b`: boolean as `0` or `1`; `s`: random five-letter string; `c`: random lowercase character

Counts must be from 1 to 1,000 per shortcut. Multiple shortcuts can be used in one input string, such as `/3n /2d /4c`.

## Keyboard shortcuts

- `Ctrl+R`: Run; `Ctrl+S`: save files
- `Ctrl+Z` / `Ctrl+Y`: undo / redo; `Shift+Alt+F`: format code
- `Ctrl+Shift+S`: download current file; `Ctrl+I`: open a local file
- `Ctrl+Shift+C`: copy a share link; `Ctrl+P`: open package installer
- `Ctrl+Shift+R`: rename current file; `Ctrl+G`: generate input shortcuts while the input box is focused

The toolbar shows each available shortcut on hover. The Help button also contains a feature guide and complete shortcut reference. Press `Escape` to close Help or a dialog.

Auto-save is enabled by default and can be toggled in the status bar. File contents and the selected file are stored in browser local storage. Use **Save** to save manually even with auto-save disabled. In portrait on narrow screens, select the active filename beside the Python logo to open the Files drawer; select the filename arrow or backdrop to close it. The Files action in the menu opens the same drawer.

On narrow portrait screens, the header keeps the Python logo, active filename, Run, Help, and theme controls visible. Open the menu button to access the remaining IDE actions. Tabs use a compact layout to leave more room for the editor.

Select text in the editor or another text area to show a **Search Google** action near the selection. The browser's normal context menu remains available.

Use **Clear** in Program input to empty the preloaded values without changing code.

The interface uses Font Awesome icons; an internet connection is required to load its stylesheet from the CDN.
