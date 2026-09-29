import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const api = window.electronAPI;

export default function App() {
  const [currentBook, setCurrentBook] = useState(null);
  const [progress, setProgress] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  const [style, setStyle] = useState({
    fontFamily: 'Georgia, serif',
    fontSize: 16,
    fontColor: '#333333',
    backgroundColor: '#fffff0',
    backgroundTexture: null,
    opacity: 1.0,
  });

  useEffect(() => {
    if (!api) return;

    api.onProgressUpdate((data) => {
      setProgress(data.progress);
    });

    api.onLocationChanged((data) => {
      setCurrentBook((prev) => (prev ? { ...prev, lastReadCfi: data.cfi } : prev));
    });

    api.getStyle().then((s) => {
      if (s) setStyle(s);
    });

    return () => {
      api.removeAllListeners('progress-update');
      api.removeAllListeners('location-changed');
    };
  }, []);

  const handleOpenEpub = async () => {
    const result = await api.openEpub();
    if (result) {
      setCurrentBook({ fileName: result.fileName, filePath: result.filePath });
      loadBookmarks(result.filePath);
    }
  };

  const loadBookmarks = async (bookId) => {
    const bm = await api.getBookmarks(bookId);
    setBookmarks(bm);
  };

  const handleStyleChange = (key, value) => {
    const newStyle = { ...style, [key]: value };
    setStyle(newStyle);
    api.updateStyle(newStyle);
    api.storeSet('style', newStyle);
  };

  const handleShowWidget = () => api.showWidget();
  const handleHideWidget = () => api.hideWidget();

  const handleGotoBookmark = (cfi) => {
    api.gotoBookmark(cfi);
    api.showWidget();
  };

  const handleRemoveBookmark = async (id) => {
    const updated = await api.removeBookmark(id);
    setBookmarks(updated);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Epub Reader</h1>
        <p className="subtitle">Upload an epub and read in a floating widget</p>
      </header>

      <section className="section">
        <h2>Library</h2>
        <button className="btn btn-primary" onClick={handleOpenEpub}>
          Open Epub File
        </button>

        {currentBook && (
          <div className="current-book">
            <h3>{currentBook.fileName}</h3>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="progress-text">{Math.round(progress * 100)}%</span>
            <div className="widget-controls">
              <button className="btn btn-small" onClick={handleShowWidget}>Show Widget</button>
              <button className="btn btn-small" onClick={handleHideWidget}>Hide Widget</button>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Bookmarks</h2>
        {bookmarks.length === 0 ? (
          <p className="empty-state">No bookmarks yet. Press Ctrl+B while reading to bookmark.</p>
        ) : (
          <ul className="bookmark-list">
            {bookmarks.map((bm) => (
              <li key={bm.id} className="bookmark-item">
                <div className="bookmark-content" onClick={() => handleGotoBookmark(bm.cfi)}>
                  <span className="bookmark-snippet">"{bm.snippet}"</span>
                  {bm.note && <span className="bookmark-note">{bm.note}</span>}
                  <span className="bookmark-date">{new Date(bm.createdAt).toLocaleDateString()}</span>
                </div>
                <button className="btn btn-danger btn-small" onClick={() => handleRemoveBookmark(bm.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Customize Widget</h2>
        <div className="customize-grid">
          <div className="control-group">
            <label>Background Color</label>
            <input
              type="color"
              value={style.backgroundColor}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Font Color</label>
            <input
              type="color"
              value={style.fontColor}
              onChange={(e) => handleStyleChange('fontColor', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Font Family</label>
            <select
              value={style.fontFamily}
              onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
            >
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
              <option value="Palatino, serif">Palatino</option>
            </select>
          </div>

          <div className="control-group">
            <label>Font Size: {style.fontSize}px</label>
            <input
              type="range"
              min="10"
              max="32"
              value={style.fontSize}
              onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Widget Opacity: {Math.round(style.opacity * 100)}%</label>
            <input
              type="range"
              min="30"
              max="100"
              value={style.opacity * 100}
              onChange={(e) => handleStyleChange('opacity', parseInt(e.target.value) / 100)}
            />
          </div>

          <div className="control-group">
            <label>Background Texture</label>
            <select
              value={style.backgroundTexture || 'none'}
              onChange={(e) =>
                handleStyleChange('backgroundTexture', e.target.value === 'none' ? null : e.target.value)
              }
            >
              <option value="none">None (Solid Color)</option>
              <option value="parchment">Parchment</option>
              <option value="paper">Paper</option>
              <option value="linen">Linen</option>
              <option value="dark-wood">Dark Wood</option>
            </select>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Ctrl+Shift+R: Toggle widget · Ctrl+B: Quick bookmark</p>
      </footer>
    </div>
  );
}
