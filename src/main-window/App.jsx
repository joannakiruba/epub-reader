import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Upload, Play, Eye, EyeOff, Bookmark, Trash2,
  Type, Palette, SlidersHorizontal, Sun, Moon,
  ChevronRight, Sparkles, CircleDot,
} from 'lucide-react';
import './App.css';

const api = window.electronAPI;

export default function App() {
  const [books, setBooks] = useState([]);
  const [activeBookId, setActiveBookId] = useState(null);
  const [progressMap, setProgressMap] = useState({});
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

  const refreshBooks = useCallback(async () => {
    if (!api) return;
    const list = await api.getBooks();
    setBooks(list || []);
    const aid = await api.getActiveBookId();
    setActiveBookId(aid);

    const pm = {};
    for (const b of (list || [])) {
      pm[b.id] = b.progress || 0;
    }
    setProgressMap(pm);
  }, []);

  useEffect(() => {
    if (!api) return;

    refreshBooks();

    api.onProgressUpdate((data) => {
      setProgressMap((prev) => {
        const updated = { ...prev };
        for (const b of books) {
          if (b.filePath) {
            updated[b.id] = data.progress;
          }
        }
        return updated;
      });
      refreshBooks();
    });

    api.onLocationChanged(() => {});

    api.onBookmarksUpdated(() => {
      api.getActiveBookId().then((aid) => {
        if (!aid) return;
        api.getBooks().then((bks) => {
          const active = (bks || []).find((b) => b.id === aid);
          if (active) {
            api.getBookmarks(active.filePath).then((bm) => setBookmarks(bm || []));
          }
        });
      });
    });

    api.getStyle().then((s) => { if (s) setStyle(s); });
    api.storeGet('mainTheme').then((t) => { if (t) setTheme(t); });

    return () => {
      api.removeAllListeners('progress-update');
      api.removeAllListeners('location-changed');
      api.removeAllListeners('bookmarks-updated');
    };
  }, []);

  useEffect(() => {
    if (!api || !activeBookId) return;
    const active = books.find((b) => b.id === activeBookId);
    if (active) {
      loadBookmarks(active.filePath);
    }
  }, [activeBookId, books]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    api?.storeSet('mainTheme', next);
  };

  const handleOpenEpub = async () => {
    if (!api) return;
    const result = await api.openEpub();
    if (result) {
      setBooks(result.books || []);
      setActiveBookId(result.activeBookId);
      refreshBooks();
    }
  };

  const handleActivateBook = async (bookId) => {
    if (!api) return;
    await api.activateBook(bookId);
    setActiveBookId(bookId);
    refreshBooks();
  };

  const handleRemoveBook = async (bookId) => {
    if (!api) return;
    const updated = await api.removeBook(bookId);
    setBooks(updated || []);
    if (activeBookId === bookId) {
      const newActive = updated && updated.length > 0 ? updated[0].id : null;
      setActiveBookId(newActive);
    }
    refreshBooks();
  };

  const handleContinueReading = async (book) => {
    if (!book || !api) return;
    await api.activateBook(book.id);
    setActiveBookId(book.id);
    api.showWidget();
  };

  const loadBookmarks = async (bookId) => {
    if (!api) return;
    const bm = await api.getBookmarks(bookId);
    setBookmarks(bm || []);
  };

  const handleStyleChange = (key, value) => {
    const newStyle = { ...style, [key]: value };
    setStyle(newStyle);
    api?.updateStyle(newStyle);
    api?.storeSet('style', newStyle);
  };

  const handleGotoBookmark = (cfi) => {
    api?.gotoBookmark(cfi);
    api?.showWidget();
  };

  const handleRemoveBookmark = async (id) => {
    if (!api) return;
    const updated = await api.removeBookmark(id);
    setBookmarks(updated);
  };

  const activeBook = books.find((b) => b.id === activeBookId);

  return (
    <div className={`app theme-${theme}`} data-theme={theme}>
      <div className="bg-noise" />

      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="brand-icon">
              <BookOpen size={22} strokeWidth={1.5} />
            </div>
            <div className="brand-text">
              <h1>Epub Reader</h1>
              <span className="brand-sub">floating reading companion</span>
            </div>
          </div>
          <button className="icon-btn theme-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
        </header>

        {/* ── Library ── */}
        <section className="glass-card">
          <div className="card-head">
            <div className="card-head-icon"><Sparkles size={16} strokeWidth={1.5} /></div>
            <h2>Library</h2>
            {books.length > 0 && <span className="badge">{books.length}</span>}
          </div>

          <button className="action-btn" onClick={handleOpenEpub}>
            <Upload size={18} strokeWidth={1.5} />
            <span>Open Epub File</span>
            <ChevronRight size={16} className="action-arrow" />
          </button>

          {books.length === 0 && (
            <div className="empty" style={{ paddingTop: 16 }}>
              <p>No books in library</p>
            </div>
          )}

          {books.map((book) => {
            const prog = progressMap[book.id] || book.progress || 0;
            const isActive = book.id === activeBookId;
            return (
              <div key={book.id} className={`book-tile ${isActive ? 'book-tile-active' : ''}`}>
                <div className="book-tile-top">
                  <div className="book-tile-icon">
                    <BookOpen size={24} strokeWidth={1.2} />
                  </div>
                  <div className="book-tile-info">
                    <h3>{book.fileName}</h3>
                    <div className="prog-row">
                      <div className="prog-track">
                        <div className="prog-fill" style={{ width: `${Math.round(prog * 100)}%` }} />
                        <div className="prog-glow" style={{ left: `${Math.round(prog * 100)}%` }} />
                      </div>
                      <span className="prog-pct">{Math.round(prog * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="book-tile-actions">
                  <button className="pill-btn pill-primary" onClick={() => handleContinueReading(book)}>
                    <Play size={14} strokeWidth={2} />
                    <span>Continue</span>
                  </button>
                  {!isActive && (
                    <button className="icon-btn" onClick={() => handleActivateBook(book.id)} title="Set active">
                      <Eye size={16} strokeWidth={1.5} />
                    </button>
                  )}
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={() => handleRemoveBook(book.id)}
                    title="Remove from library"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Bookmarks ── */}
        <section className="glass-card">
          <div className="card-head">
            <div className="card-head-icon"><Bookmark size={16} strokeWidth={1.5} /></div>
            <h2>Bookmarks</h2>
            {activeBook && <span className="badge">{activeBook.fileName}</span>}
            {bookmarks.length > 0 && <span className="badge">{bookmarks.length}</span>}
          </div>

          {bookmarks.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Bookmark size={36} strokeWidth={1} />
              </div>
              <p>No bookmarks yet</p>
              <span className="empty-hint">Press <kbd>Ctrl+B</kbd> while reading</span>
            </div>
          ) : (
            <ul className="bm-list">
              {bookmarks.map((bm) => (
                <li key={bm.id} className="bm-row" onClick={() => handleGotoBookmark(bm.cfi)}>
                  <div className="bm-pip" />
                  <div className="bm-body">
                    <p className="bm-text">{bm.snippet}</p>
                    {bm.note && <p className="bm-note">{bm.note}</p>}
                    <span className="bm-date">{new Date(bm.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={(e) => { e.stopPropagation(); handleRemoveBookmark(bm.id); }}
                    title="Remove"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Customize ── */}
        <section className="glass-card">
          <div className="card-head">
            <div className="card-head-icon"><SlidersHorizontal size={16} strokeWidth={1.5} /></div>
            <h2>Customize Widget</h2>
          </div>

          <div className="opts">
            <label className="opt-row">
              <span className="opt-label"><Palette size={14} strokeWidth={1.5} /> Background</span>
              <div className="color-wrap">
                <input type="color" value={style.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} />
                <code>{style.backgroundColor}</code>
              </div>
            </label>

            <label className="opt-row">
              <span className="opt-label"><Type size={14} strokeWidth={1.5} /> Font Color</span>
              <div className="color-wrap">
                <input type="color" value={style.fontColor}
                  onChange={(e) => handleStyleChange('fontColor', e.target.value)} />
                <code>{style.fontColor}</code>
              </div>
            </label>

            <label className="opt-row">
              <span className="opt-label"><Type size={14} strokeWidth={1.5} /> Font</span>
              <select className="sel" value={style.fontFamily}
                onChange={(e) => handleStyleChange('fontFamily', e.target.value)}>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                <option value="Palatino, serif">Palatino</option>
              </select>
            </label>

            <label className="opt-row">
              <span className="opt-label"><CircleDot size={14} strokeWidth={1.5} /> Size <em>{style.fontSize}px</em></span>
              <input type="range" className="slider" min="10" max="32"
                value={style.fontSize}
                onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))} />
            </label>

            <label className="opt-row">
              <span className="opt-label"><SlidersHorizontal size={14} strokeWidth={1.5} /> Opacity <em>{Math.round(style.opacity * 100)}%</em></span>
              <input type="range" className="slider" min="30" max="100"
                value={style.opacity * 100}
                onChange={(e) => handleStyleChange('opacity', parseInt(e.target.value) / 100)} />
            </label>

            <label className="opt-row">
              <span className="opt-label"><Palette size={14} strokeWidth={1.5} /> Texture</span>
              <select className="sel" value={style.backgroundTexture || 'none'}
                onChange={(e) =>
                  handleStyleChange('backgroundTexture', e.target.value === 'none' ? null : e.target.value)
                }>
                <option value="none">None</option>
                <option value="parchment">Parchment</option>
                <option value="paper">Paper</option>
                <option value="linen">Linen</option>
                <option value="dark-wood">Dark Wood</option>
              </select>
            </label>
          </div>
        </section>

        <footer className="foot">
          <kbd>Ctrl+Shift+R</kbd> <span>toggle widget</span>
          <span className="foot-sep" />
          <kbd>Ctrl+B</kbd> <span>bookmark</span>
        </footer>
      </div>
    </div>
  );
}
