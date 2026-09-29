# Epub Reader — Setup Guide

A desktop app for reading `.epub` files in a small, floating widget that stays on top of your other windows. Includes bookmarks, reading progress tracking, and full customization of fonts, colors, and textures.

---

## Prerequisites

- **Node.js** v18 or newer — [download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

Verify your install:

```bash
node --version
npm --version
```

---

## Option A: Run from Source (Development Mode)

Best for trying it out quickly.

### 1. Get the code

```bash
git clone <your-repo-url> epub-reader
cd epub-reader
```

Or if you already have the folder, just `cd` into it.

### 2. Install dependencies

```bash
npm install
```

### 3. Start the app

```bash
npm run dev
```

This launches the Vite dev server and opens the Electron app. Two windows appear:

- **Main window** — upload epubs, manage bookmarks, customize the widget
- **Widget** — a small floating reader (hidden until you open an epub)

---

## Option B: Build a Standalone Desktop App

Produces an installable app you can double-click to run — no terminal needed.

### 1. Install dependencies (if you haven't)

```bash
npm install
```

### 2. Build for your platform

**Windows:**
```bash
npm run build:win
```
Output: `release/Epub Reader Setup <version>.exe` (NSIS installer)

**macOS:**
```bash
npm run build:mac
```
Output: `release/Epub Reader-<version>.dmg`

**Linux:**
```bash
npm run build:linux
```
Output: `release/Epub Reader-<version>.AppImage` and/or `.deb`

### 3. Install and run

- **Windows** — Run the `.exe` installer. It will guide you through installation. Launch from the Start Menu or desktop shortcut.
- **macOS** — Open the `.dmg`, drag "Epub Reader" into your Applications folder. Launch from Applications or Spotlight.
- **Linux (AppImage)** — Make it executable and run:
  ```bash
  chmod +x "Epub Reader-<version>.AppImage"
  ./"Epub Reader-<version>.AppImage"
  ```
- **Linux (deb)** — Install with:
  ```bash
  sudo dpkg -i epub-reader_<version>_amd64.deb
  ```

---

## How to Use

### Opening a Book

1. In the main window, click **Open Epub File**.
2. Select a `.epub` file from your computer.
3. The floating widget appears with your book loaded.

### The Reading Widget

The widget is a small, frameless window that floats on top of everything:

- **Drag** it by the title bar at the top
- **Resize** it by dragging any edge or corner
- **Navigate** with the arrow buttons (← →) in the title bar
- **Close/hide** with the ✕ button

The widget stays on top of all other windows, so you can read while working.

### Hiding and Showing the Widget

The widget can be completely hidden — no taskbar icon, no trace on screen.

| Action | How |
|---|---|
| **Toggle widget** | Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) |
| **Hide widget** | Click ✕ on the widget, or click "Hide Widget" in main window |
| **Show widget** | Press `Ctrl+Shift+R`, click "Show Widget" in main window, or use the system tray icon |
| **System tray** | Right-click the tray icon (bottom-right on Windows, top bar on Mac) for Show/Hide/Quit |

When you bring the widget back, it returns to the **exact same position, size, and reading location** you left it at.

### Bookmarks

- Press `Ctrl+B` (`Cmd+B` on Mac) while reading to bookmark your current spot
- If you have text selected, the bookmark saves that text as its snippet
- Otherwise, it grabs the first paragraph near your reading position
- View all bookmarks in the main window under **Bookmarks**
- Click a bookmark to jump to that location
- Delete bookmarks with the ✕ button next to each one

### Reading Progress

- Your reading position is **auto-saved** every time you turn a page or scroll
- A progress bar in the main window shows how far through the book you are
- If you close and reopen the app, you resume exactly where you left off

### Customizing the Widget

In the main window under **Customize Widget**, you can change:

| Setting | Options |
|---|---|
| **Background color** | Any color via color picker |
| **Background texture** | None, Parchment, Paper, Linen, Dark Wood |
| **Font family** | Georgia, Times New Roman, Arial, Verdana, Courier New, Trebuchet MS, Palatino |
| **Font size** | 10px to 32px (slider) |
| **Font color** | Any color via color picker |
| **Widget opacity** | 30% to 100% (slider) |

All changes apply to the widget **instantly** — no need to restart or reload.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+R` | Toggle widget visibility |
| `Ctrl+B` | Quick bookmark current position |

On macOS, replace `Ctrl` with `Cmd`.

---

## Data Storage

All your settings, bookmarks, and reading progress are stored locally on your machine. Nothing is sent to the internet.

- **Windows:** `%APPDATA%/epub-reader/config.json`
- **macOS:** `~/Library/Application Support/epub-reader/config.json`
- **Linux:** `~/.config/epub-reader/config.json`

---

## Troubleshooting

**App won't start (dev mode)**
Make sure the Vite dev server is running. `npm run dev` starts both processes. If port 5173 is in use, stop whatever is using it first.

**Widget doesn't appear after opening a book**
Press `Ctrl+Shift+R` to toggle it. The widget starts hidden and shows when you open an epub. If it still doesn't appear, check the system tray icon.

**Epub doesn't render correctly**
Some epubs with complex layouts or DRM may not render properly. The app uses epub.js which supports standard, DRM-free epub files.

**Build fails**
Make sure you have enough disk space (~500MB for the build). On Linux, you may need additional packages:
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
```
