const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openEpub: () => ipcRenderer.invoke('open-epub'),
  loadEpub: (filePath) => ipcRenderer.invoke('load-epub', filePath),
  getCurrentBook: () => ipcRenderer.invoke('get-current-book'),
  saveBookProgress: (data) => ipcRenderer.invoke('save-book-progress', data),

  showWidget: () => ipcRenderer.send('widget-show'),
  hideWidget: () => ipcRenderer.send('widget-hide'),
  toggleWidget: () => ipcRenderer.send('widget-toggle'),

  navigate: (direction) => ipcRenderer.send('navigate', direction),
  onNavigate: (cb) => ipcRenderer.on('navigate', (_, dir) => cb(dir)),

  onLocationChanged: (cb) => ipcRenderer.on('location-changed', (_, data) => cb(data)),
  sendLocationChanged: (data) => ipcRenderer.send('location-changed', data),

  onProgressUpdate: (cb) => ipcRenderer.on('progress-update', (_, data) => cb(data)),
  sendProgressUpdate: (data) => ipcRenderer.send('progress-update', data),

  addBookmark: (bookmark) => ipcRenderer.invoke('bookmark-add', bookmark),
  removeBookmark: (id) => ipcRenderer.invoke('bookmark-remove', id),
  getBookmarks: (bookId) => ipcRenderer.invoke('bookmark-list', bookId),
  onBookmarkGoto: (cb) => ipcRenderer.on('bookmark-goto', (_, cfi) => cb(cfi)),
  gotoBookmark: (cfi) => ipcRenderer.send('bookmark-goto', cfi),

  updateStyle: (style) => ipcRenderer.send('style-update', style),
  onStyleUpdate: (cb) => ipcRenderer.on('style-update', (_, style) => cb(style)),
  getStyle: () => ipcRenderer.invoke('get-style'),

  onEpubOpened: (cb) => ipcRenderer.on('epub-opened', (_, data) => cb(data)),

  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  onQuickBookmark: (cb) => ipcRenderer.on('quick-bookmark', () => cb()),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
