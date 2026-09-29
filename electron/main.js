const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupTray } = require('./tray');

let mainWindow = null;
let widgetWindow = null;
let tray = null;

const isDev = !app.isPackaged;
const preloadPath = path.join(__dirname, 'preload.js');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (widgetWindow) widgetWindow.close();
    app.quit();
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

function setupIPC() {
  ipcMain.handle('open-epub', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const fileData = fs.readFileSync(filePath);
    const base64 = fileData.toString('base64');
    const fileName = path.basename(filePath);

    const bookInfo = { fileName, filePath, progress: 0, lastReadCfi: null };
    store.set('currentBook', bookInfo);

    if (widgetWindow) {
      widgetWindow.webContents.send('epub-opened', { base64, fileName, filePath });
      widgetWindow.show();
    }

    return bookInfo;
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

  ipcMain.handle('get-current-book', async () => {
    return store.get('currentBook', null);
  });

  ipcMain.handle('save-book-progress', async (_, { filePath, cfi, progress }) => {
    const current = store.get('currentBook');
    if (current && current.filePath === filePath) {
      current.lastReadCfi = cfi;
      current.progress = progress;
      store.set('currentBook', current);
    }
  });

  let dragOffset = null;

  ipcMain.on('widget-start-drag', (_, screenX, screenY) => {
    if (!widgetWindow) return;
    const [winX, winY] = widgetWindow.getPosition();
    dragOffset = { x: screenX - winX, y: screenY - winY };
  });

  ipcMain.on('widget-dragging', (_, screenX, screenY) => {
    if (!widgetWindow || !dragOffset) return;
    widgetWindow.setPosition(
      Math.round(screenX - dragOffset.x),
      Math.round(screenY - dragOffset.y)
    );
  });

  ipcMain.on('widget-stop-drag', () => {
    dragOffset = null;
  });

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

  ipcMain.on('navigate', (_, direction) => {
    if (widgetWindow) {
      widgetWindow.webContents.send('navigate', direction);
    }
  });

  ipcMain.on('location-changed', (_, data) => {
    if (mainWindow) {
      mainWindow.webContents.send('location-changed', data);
    }
  });

  ipcMain.on('progress-update', (_, data) => {
    if (mainWindow) {
      mainWindow.webContents.send('progress-update', data);
    }
  });

  ipcMain.on('style-update', (_, style) => {
    if (widgetWindow) {
      widgetWindow.webContents.send('style-update', style);
    }
  });

  ipcMain.handle('get-style', async () => {
    return store.get('style', defaultStyle);
  });

  ipcMain.handle('bookmark-add', async (_, bookmark) => {
    const bookmarks = store.get('bookmarks', []);
    bookmarks.push(bookmark);
    store.set('bookmarks', bookmarks);
    return bookmarks;
  });

  ipcMain.handle('bookmark-remove', async (_, id) => {
    let bookmarks = store.get('bookmarks', []);
    bookmarks = bookmarks.filter((b) => b.id !== id);
    store.set('bookmarks', bookmarks);
    return bookmarks;
  });

  ipcMain.handle('bookmark-list', async (_, bookId) => {
    const bookmarks = store.get('bookmarks', []);
    if (bookId) return bookmarks.filter((b) => b.bookId === bookId);
    return bookmarks;
  });

  ipcMain.on('bookmark-goto', (_, cfi) => {
    if (widgetWindow) {
      widgetWindow.webContents.send('bookmark-goto', cfi);
    }
  });

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
