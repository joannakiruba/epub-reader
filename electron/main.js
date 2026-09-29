const { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupTray } = require('./tray');

let mainWindow = null;
let widgetWindow = null;
let tray = null;
let isQuitting = false;

const isDev = !app.isPackaged;
const preloadPath = path.join(__dirname, 'preload.js');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Epub Reader',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/index.html');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createWidgetWindow() {
  widgetWindow = new BrowserWindow({
    width: 400,
    height: 300,
    minWidth: 200,
    minHeight: 150,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    widgetWindow.loadURL('http://localhost:5173/widget.html');
  } else {
    widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'));
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });

  widgetWindow.on('move', () => {
    if (!widgetWindow || !store) return;
    const bounds = widgetWindow.getBounds();
    const ws = store.get('widgetState', {});
    store.set('widgetState', { ...ws, x: bounds.x, y: bounds.y });
  });

  widgetWindow.on('resize', () => {
    if (!widgetWindow || !store) return;
    const bounds = widgetWindow.getBounds();
    const ws = store.get('widgetState', {});
    store.set('widgetState', { ...ws, width: bounds.width, height: bounds.height });
  });

  const savedState = store ? store.get('widgetState') : null;
  if (savedState) {
    widgetWindow.setBounds({
      x: savedState.x,
      y: savedState.y,
      width: savedState.width || 400,
      height: savedState.height || 300,
    });
  }

  widgetWindow.hide();
}

function getBooks() {
  return store.get('books', []);
}

function saveBooks(books) {
  store.set('books', books);
}

function findBook(filePath) {
  return getBooks().find((b) => b.filePath === filePath);
}

function upsertBook(filePath, fileName) {
  let books = getBooks();
  let book = books.find((b) => b.filePath === filePath);
  if (!book) {
    book = { id: Date.now().toString(), fileName, filePath, progress: 0, lastReadCfi: null };
    books.push(book);
    saveBooks(books);
  }
  store.set('activeBookId', book.id);
  return book;
}

function setupIPC() {
  // ── Book management ──
  ipcMain.handle('open-epub', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const opened = [];
    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      const book = upsertBook(filePath, fileName);
      opened.push(book);
    }

    const last = opened[opened.length - 1];
    const fileData = fs.readFileSync(last.filePath);
    const base64 = fileData.toString('base64');

    if (widgetWindow) {
      widgetWindow.webContents.send('epub-opened', {
        base64,
        fileName: last.fileName,
        filePath: last.filePath,
      });
      widgetWindow.show();
    }

    return { books: getBooks(), activeBookId: last.id };
  });

  ipcMain.handle('get-books', async () => {
    return getBooks();
  });

  ipcMain.handle('get-active-book-id', async () => {
    return store.get('activeBookId', null);
  });

  ipcMain.handle('activate-book', async (_, bookId) => {
    const books = getBooks();
    const book = books.find((b) => b.id === bookId);
    if (!book || !fs.existsSync(book.filePath)) return null;

    store.set('activeBookId', bookId);
    const fileData = fs.readFileSync(book.filePath);
    const base64 = fileData.toString('base64');

    if (widgetWindow) {
      widgetWindow.webContents.send('epub-opened', {
        base64,
        fileName: book.fileName,
        filePath: book.filePath,
      });
      widgetWindow.show();
    }

    return book;
  });

  ipcMain.handle('remove-book', async (_, bookId) => {
    let books = getBooks();
    const removedBook = books.find((b) => b.id === bookId);
    books = books.filter((b) => b.id !== bookId);
    saveBooks(books);

    if (removedBook) {
      let bookmarks = store.get('bookmarks', []);
      bookmarks = bookmarks.filter((bm) => bm.bookId !== removedBook.filePath);
      store.set('bookmarks', bookmarks);
    }

    const activeId = store.get('activeBookId');
    if (activeId === bookId) {
      store.set('activeBookId', books.length > 0 ? books[0].id : null);
    }

    return books;
  });

  ipcMain.handle('load-epub', async (_, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return null;

    const fileData = fs.readFileSync(filePath);
    const base64 = fileData.toString('base64');
    const fileName = path.basename(filePath);

    if (widgetWindow) {
      widgetWindow.webContents.send('epub-opened', { base64, fileName, filePath });
    }

    return { base64, fileName, filePath };
  });

  ipcMain.handle('read-epub-file', async (_, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const fileData = fs.readFileSync(filePath);
    return fileData.toString('base64');
  });

  ipcMain.handle('get-current-book', async () => {
    const activeId = store.get('activeBookId');
    if (!activeId) return null;
    const books = getBooks();
    return books.find((b) => b.id === activeId) || null;
  });

  ipcMain.handle('save-book-progress', async (_, { filePath, cfi, progress }) => {
    let books = getBooks();
    const idx = books.findIndex((b) => b.filePath === filePath);
    if (idx !== -1) {
      books[idx].lastReadCfi = cfi;
      if (progress !== undefined && progress !== null) {
        books[idx].progress = progress;
      }
      saveBooks(books);
    }
  });

  // ── Drag: poll cursor in main process, lock size with setBounds ──
  let dragState = null;
  let dragInterval = null;

  function stopDrag() {
    if (dragInterval) {
      clearInterval(dragInterval);
      dragInterval = null;
    }
    if (widgetWindow && dragState) {
      widgetWindow.setMinimumSize(200, 150);
      widgetWindow.setMaximumSize(0, 0);
      widgetWindow.setResizable(true);
    }
    dragState = null;
  }

  ipcMain.on('widget-start-drag', (_, screenX, screenY) => {
    if (!widgetWindow) return;
    const bounds = widgetWindow.getBounds();
    dragState = {
      offsetX: screenX - bounds.x,
      offsetY: screenY - bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    widgetWindow.setResizable(false);
    widgetWindow.setMinimumSize(bounds.width, bounds.height);
    widgetWindow.setMaximumSize(bounds.width, bounds.height);

    if (dragInterval) clearInterval(dragInterval);
    dragInterval = setInterval(() => {
      if (!widgetWindow || !dragState) {
        stopDrag();
        return;
      }
      const cursor = screen.getCursorScreenPoint();
      widgetWindow.setBounds({
        x: Math.round(cursor.x - dragState.offsetX),
        y: Math.round(cursor.y - dragState.offsetY),
        width: dragState.width,
        height: dragState.height,
      });
    }, 16);
  });

  ipcMain.on('widget-dragging', () => {});
  ipcMain.on('widget-stop-drag', stopDrag);

  // ── Widget visibility ──
  ipcMain.on('widget-show', () => {
    if (widgetWindow) widgetWindow.show();
  });

  ipcMain.on('widget-hide', () => {
    if (widgetWindow) widgetWindow.hide();
  });

  ipcMain.on('widget-toggle', () => {
    if (!widgetWindow) return;
    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      widgetWindow.show();
    }
  });

  // ── Forwarding ──
  ipcMain.on('navigate', (_, direction) => {
    if (widgetWindow) widgetWindow.webContents.send('navigate', direction);
  });

  ipcMain.on('location-changed', (_, data) => {
    if (mainWindow) mainWindow.webContents.send('location-changed', data);
  });

  ipcMain.on('progress-update', (_, data) => {
    if (mainWindow) mainWindow.webContents.send('progress-update', data);
  });

  ipcMain.on('style-update', (_, style) => {
    if (widgetWindow) widgetWindow.webContents.send('style-update', style);
  });

  ipcMain.handle('get-style', async () => {
    return store.get('style', defaultStyle);
  });

  // ── Bookmarks ──
  ipcMain.handle('bookmark-add', async (_, bookmark) => {
    const bookmarks = store.get('bookmarks', []);
    bookmarks.push(bookmark);
    store.set('bookmarks', bookmarks);
    if (mainWindow) {
      mainWindow.webContents.send('bookmarks-updated', bookmarks);
    }
    return bookmarks;
  });

  ipcMain.handle('bookmark-remove', async (_, id) => {
    let bookmarks = store.get('bookmarks', []);
    bookmarks = bookmarks.filter((b) => b.id !== id);
    store.set('bookmarks', bookmarks);
    if (mainWindow) {
      mainWindow.webContents.send('bookmarks-updated', bookmarks);
    }
    return bookmarks;
  });

  ipcMain.handle('bookmark-list', async (_, bookId) => {
    const bookmarks = store.get('bookmarks', []);
    if (bookId) return bookmarks.filter((b) => b.bookId === bookId);
    return bookmarks;
  });

  ipcMain.on('bookmark-goto', (_, cfi) => {
    if (widgetWindow) widgetWindow.webContents.send('bookmark-goto', cfi);
  });

  // ── Generic store ──
  ipcMain.handle('store-get', async (_, key) => {
    return store.get(key);
  });

  ipcMain.handle('store-set', async (_, key, value) => {
    store.set(key, value);
  });
}

const defaultStyle = {
  fontFamily: 'Georgia, serif',
  fontSize: 16,
  fontColor: '#333333',
  backgroundColor: '#fffff0',
  backgroundTexture: null,
  opacity: 1.0,
};

let store;

app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store({
    defaults: {
      style: defaultStyle,
      bookmarks: [],
      books: [],
      activeBookId: null,
      widgetState: { x: 100, y: 100, width: 400, height: 300, visible: false },
    },
  });

  createMainWindow();
  createWidgetWindow();
  setupIPC();
  tray = setupTray(mainWindow, widgetWindow);

  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (!widgetWindow) return;
    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      widgetWindow.show();
    }
  });

  globalShortcut.register('CommandOrControl+B', () => {
    if (widgetWindow && widgetWindow.isVisible()) {
      widgetWindow.webContents.send('quick-bookmark');
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit — app stays alive in tray
});
