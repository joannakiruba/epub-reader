import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ePub from 'epubjs';
import './App.css';

const api = window.electronAPI;

function hexToLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export default function App() {
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const currentCfiRef = useRef(null);
  const currentBookIdRef = useRef(null);
  const styleRef = useRef(null);
  const [hasBook, setHasBook] = useState(false);
  const [style, setStyle] = useState({
    fontFamily: 'Georgia, serif',
    fontSize: 16,
    fontColor: '#333333',
    backgroundColor: '#fffff0',
    backgroundTexture: null,
    opacity: 1.0,
  });

  styleRef.current = style;

  const isDark = useMemo(() => hexToLuminance(style.backgroundColor) < 0.4, [style.backgroundColor]);
  const controlColor = isDark ? '#ffffff' : '#000000';

  const applyStyle = useCallback((rendition, s) => {
    if (!rendition) return;
    rendition.themes.default({
      body: {
        'font-family': s.fontFamily + ' !important',
        'font-size': s.fontSize + 'px !important',
        color: s.fontColor + ' !important',
        background: 'transparent !important',
      },
      p: {
        'font-family': s.fontFamily + ' !important',
        'font-size': s.fontSize + 'px !important',
        color: s.fontColor + ' !important',
      },
    });
  }, []);

  const loadBook = useCallback(
    async (base64Data) => {
      if (bookRef.current) {
        bookRef.current.destroy();
      }
      if (viewerRef.current) {
        viewerRef.current.innerHTML = '';
      }

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const book = ePub(bytes.buffer);
      bookRef.current = book;

      await book.ready;

      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'scrolled-doc',
      });

      renditionRef.current = rendition;
      applyStyle(rendition, styleRef.current);

      rendition.hooks.content.register((contents) => {
        const doc = contents.document;
        const styleEl = doc.createElement('style');
        styleEl.textContent = `
          html, body { overflow-x: hidden !important; }
          ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
          * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        `;
        doc.head.appendChild(styleEl);
      });

      let locationsReady = false;

      rendition.on('relocated', (location) => {
        const cfi = location.start.cfi;
        currentCfiRef.current = cfi;

        if (api) {
          api.sendLocationChanged({ cfi });
          if (locationsReady) {
            const progress = location.start.percentage || 0;
            api.sendProgressUpdate({ progress });
            api.saveBookProgress({
              filePath: currentBookIdRef.current,
              cfi,
              progress,
            });
          } else {
            api.saveBookProgress({
              filePath: currentBookIdRef.current,
              cfi,
              progress: undefined,
            });
          }
        }
      });

      const savedBook = await api?.getCurrentBook();
      const resumeCfi = savedBook?.filePath === currentBookIdRef.current
        ? savedBook.lastReadCfi
        : null;
      const savedProgress = savedBook?.progress || 0;

      if (api) {
        api.sendProgressUpdate({ progress: savedProgress });
      }

      if (resumeCfi) {
        await rendition.display(resumeCfi);
      } else {
        await rendition.display();
      }

      setHasBook(true);

      book.locations.generate(1024).then(() => {
        locationsReady = true;
        if (renditionRef.current) {
          const loc = renditionRef.current.currentLocation();
          if (loc && loc.start) {
            const progress = loc.start.percentage || 0;
            api?.sendProgressUpdate({ progress });
            api?.saveBookProgress({
              filePath: currentBookIdRef.current,
              cfi: loc.start.cfi,
              progress,
            });
          }
        }
      });
    },
    [applyStyle]
  );

  useEffect(() => {
    if (!api) return;

    api.getStyle().then((s) => {
      if (s) setStyle(s);
    });

    const handleEpubOpened = (data) => {
      currentBookIdRef.current = data.filePath;
      loadBook(data.base64);
    };

    const handleStyleUpdate = (s) => {
      setStyle(s);
      if (renditionRef.current) {
        applyStyle(renditionRef.current, s);
      }
    };

    const handleNavigate = (direction) => {
      if (!renditionRef.current) return;
      if (direction === 'next') renditionRef.current.next();
      else if (direction === 'prev') renditionRef.current.prev();
    };

    const handleBookmarkGoto = (cfi) => {
      if (renditionRef.current) {
        renditionRef.current.display(cfi);
      }
    };

    const handleQuickBookmark = async () => {
      const cfi = currentCfiRef.current;
      const bookId = currentBookIdRef.current;
      if (!cfi || !bookId) return;

      const rendition = renditionRef.current;
      let snippet = '';
      if (rendition) {
        const contents = rendition.getContents();
        if (contents && contents.length > 0) {
          const doc = contents[0].document;
          const selection = doc.getSelection();
          if (selection && selection.toString()) {
            snippet = selection.toString().substring(0, 80);
          } else {
            const paras = doc.querySelectorAll('p');
            for (const p of paras) {
              const text = p.textContent.trim();
              if (text.length > 10) {
                snippet = text.substring(0, 80);
                break;
              }
            }
          }
        }
      }

      await api.addBookmark({
        id: Date.now().toString(),
        bookId,
        cfi,
        snippet: snippet || 'Bookmark',
        note: null,
        createdAt: new Date().toISOString(),
      });
    };

    api.onEpubOpened(handleEpubOpened);
    api.onStyleUpdate(handleStyleUpdate);
    api.onNavigate(handleNavigate);
    api.onBookmarkGoto(handleBookmarkGoto);
    api.onQuickBookmark(handleQuickBookmark);

    api.getCurrentBook().then((book) => {
      if (book && book.filePath) {
        api.readEpubFile(book.filePath).then((base64) => {
          if (base64) {
            currentBookIdRef.current = book.filePath;
            loadBook(base64);
          }
        });
      }
    });

    return () => {
      api.removeAllListeners('epub-opened');
      api.removeAllListeners('style-update');
      api.removeAllListeners('navigate');
      api.removeAllListeners('bookmark-goto');
      api.removeAllListeners('quick-bookmark');
    };
  }, [loadBook, applyStyle]);

  const handlePrev = () => renditionRef.current?.prev();
  const handleNext = () => renditionRef.current?.next();
  const handleHide = () => api?.hideWidget();

  const titlebarRef = useRef(null);

  const handleDragPointerDown = (e) => {
    if (e.target.closest('.widget-nav')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = titlebarRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);

    api?.startDrag(e.screenX, e.screenY);

    const onPointerUp = (ev) => {
      api?.stopDrag();
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('lostpointercapture', onLost);
    };
    const onLost = () => {
      api?.stopDrag();
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('lostpointercapture', onLost);
    };
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('lostpointercapture', onLost);
  };

  const textureMap = {
    parchment: 'repeating-linear-gradient(135deg, rgba(139,110,78,0.08) 0px, transparent 2px, transparent 4px, rgba(139,110,78,0.05) 6px)',
    paper: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.01) 0px, transparent 1px, transparent 3px, rgba(0,0,0,0.02) 4px)',
    linen: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(128,128,128,0.06) 2px, rgba(128,128,128,0.06) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(128,128,128,0.04) 2px, rgba(128,128,128,0.04) 4px)',
    'dark-wood': 'repeating-linear-gradient(175deg, rgba(60,40,20,0.12) 0px, transparent 3px, transparent 6px, rgba(60,40,20,0.08) 9px)',
  };

  const bgStyle = {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundTexture ? textureMap[style.backgroundTexture] : 'none',
    opacity: style.opacity,
    color: controlColor,
  };

  const btnStyle = { color: controlColor };

  return (
    <div className="widget" style={bgStyle}>
      <div className="widget-titlebar" ref={titlebarRef} onPointerDown={handleDragPointerDown} style={{ touchAction: 'none' }}>
        <span className="widget-drag-hint" style={{ color: controlColor }}>&#x2807;</span>
        <div className="widget-nav">
          <button onClick={handlePrev} title="Previous" style={btnStyle}>&#x2190;</button>
          <button onClick={handleNext} title="Next" style={btnStyle}>&#x2192;</button>
          <button onClick={handleHide} title="Hide (Ctrl+Shift+R)" style={btnStyle}>&#x2715;</button>
        </div>
      </div>
      {!hasBook && (
        <div className="empty-widget" style={{ color: controlColor }}>
          <p>Open an epub from the main window</p>
        </div>
      )}
      <div className="reader-container" ref={viewerRef} />
    </div>
  );
}
