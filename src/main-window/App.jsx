import React, { useState, useEffect } from 'react';
import {
  BookOpen, Upload, Play, Eye, EyeOff, Bookmark, Trash2,
  Type, Palette, SlidersHorizontal, Sun, Moon, Keyboard,
} from 'lucide-react';
import './App.css';

const api = window.electronAPI;

export default function App() {
  const [currentBook, setCurrentBook] = useState(null);
  const [progress, setProgress] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  const [theme, setTheme] = useState('dark');
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

    api.getCurrentBook().then((book) => {
      if (book) {
        setCurrentBook(book);
        setProgress(book.progress || 0);
        loadBookmarks(book.filePath);
      }
    });

    api.storeGet('mainTheme').then((t) => {
      if (t) setTheme(t);
    });

    return () => {
      api.removeAllListeners('progress-update');
      api.removeAllListeners('location-changed');
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    api?.storeSet('mainTheme', next);
  };

  const handleOpenEpub = async () => {
    const result = await api.openEpub();
    if (result) {
      setCurrentBook(result);
      setProgress(result.progress || 0);
      loadBookmarks(result.filePath);
    }
  };

  const handleContinueReading = async () => {
    if (!currentBook) return;
    await api.loadEpub(currentBook.filePath);
    api.showWidget();
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
    <div className={`app ${theme}`}>
      <div className="app-inner">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <BookOpen size={28} strokeWidth={1.5} />
            </div>
            <div>
              <h1>Epub Reader</h1>
              <p className="subtitle">Your floating reading companion</p>
            </div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <section className="card">
          <div className="card-header">
            <BookOpen size={18} strokeWidth={1.5} />
            <h2>Library</h2>
          </div>

          <button className="btn btn-primary" onClick={handleOpenEpub}>
            <Upload size={16} />
            Open Epub File
          </button>

          {currentBook && (
            <div className="book-card">
              <div className="book-info">
                <BookOpen size={20} className="book-icon" />
                <div className="book-details">
                  <h3>{currentBook.fileName}</h3>
                  <div className="progress-row">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                    </div>
                    <span className="progress-label">{Math.round(progress * 100)}%</span>
                  </div>
                </div>
              </div>
              <div className="book-actions">
                <button className="btn btn-accent" onClick={handleContinueReading}>
                  <Play size={14} />
                  Continue Reading
                </button>
                <button className="btn btn-ghost" onClick={handleShowWidget} title="Show Widget">
                  <Eye size={14} />
                </button>
                <button className="btn btn-ghost" onClick={handleHideWidget} title="Hide Widget">
                  <EyeOff size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <Bookmark size={18} strokeWidth={1.5} />
            <h2>Bookmarks</h2>
          </div>

          {bookmarks.length === 0 ? (
            <div className="empty-state">
              <Bookmark size={32} strokeWidth={1} />
              <p>No bookmarks yet</p>
              <span>Press Ctrl+B while reading to add one</span>
            </div>
          ) : (
            <ul className="bookmark-list">
              {bookmarks.map((bm) => (
                <li key={bm.id} className="bookmark-item" onClick={() => handleGotoBookmark(bm.cfi)}>
                  <div className="bookmark-marker" />
                  <div className="bookmark-body">
                    <p className="bookmark-snippet">{bm.snippet}</p>
                    {bm.note && <p className="bookmark-note">{bm.note}</p>}
                    <span className="bookmark-date">{new Date(bm.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={(e) => { e.stopPropagation(); handleRemoveBookmark(bm.id); }}
                    title="Remove bookmark"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <SlidersHorizontal size={18} strokeWidth={1.5} />
            <h2>Customize Widget</h2>
          </div>

          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-label">
                <Palette size={14} />
                <span>Background Color</span>
              </div>
              <div className="color-picker-wrap">
                <input
                  type="color"
                  value={style.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                />
                <span className="color-value">{style.backgroundColor}</span>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <Type size={14} />
                <span>Font Color</span>
              </div>
              <div className="color-picker-wrap">
                <input
                  type="color"
                  value={style.fontColor}
                  onChange={(e) => handleStyleChange('fontColor', e.target.value)}
                />
                <span className="color-value">{style.fontColor}</span>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <Type size={14} />
                <span>Font Family</span>
              </div>
              <select
                className="select"
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

            <div className="setting-item">
              <div className="setting-label">
                <Type size={14} />
                <span>Font Size</span>
                <span className="setting-value">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                className="range"
                min="10"
                max="32"
                value={style.fontSize}
                onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
              />
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <SlidersHorizontal size={14} />
                <span>Opacity</span>
                <span className="setting-value">{Math.round(style.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="range"
                min="30"
                max="100"
                value={style.opacity * 100}
                onChange={(e) => handleStyleChange('opacity', parseInt(e.target.value) / 100)}
              />
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <Palette size={14} />
                <span>Texture Overlay</span>
              </div>
              <select
                className="select"
                value={style.backgroundTexture || 'none'}
                onChange={(e) =>
                  handleStyleChange('backgroundTexture', e.target.value === 'none' ? null : e.target.value)
                }
              >
                <option value="none">None</option>
                <option value="parchment">Parchment</option>
                <option value="paper">Paper</option>
                <option value="linen">Linen</option>
                <option value="dark-wood">Dark Wood</option>
              </select>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="shortcut">
            <Keyboard size={12} />
            <span>Ctrl+Shift+R toggle widget</span>
          </div>
          <div className="shortcut">
            <Bookmark size={12} />
            <span>Ctrl+B quick bookmark</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
