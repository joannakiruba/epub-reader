import React, { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import './App.css';

const api = window.electronAPI;

export default function App() {
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const currentCfiRef = useRef(null);
  const currentBookIdRef = useRef(null);
  const [hasBook, setHasBook] = useState(false);
  const [style, setStyle] = useState({
    fontFamily: 'Georgia, serif',
    fontSize: 16,
    fontColor: '#333333',
    backgroundColor: '#fffff0',
    backgroundTexture: null,
    opacity: 1.0,
  });

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
      applyStyle(rendition, style);

      rendition.on('relocated', (location) => {
        const cfi = location.start.cfi;
        currentCfiRef.current = cfi;

        const progress = location.start.percentage || 0;

        if (api) {
          api.sendLocationChanged({ cfi });
          api.sendProgressUpdate({ progress });
          api.storeSet('lastReadCfi', cfi);
        }
      });

      const lastCfi = await api?.storeGet('lastReadCfi');
      if (lastCfi) {
        await rendition.display(lastCfi);
      } else {
        await rendition.display();
      }

      setHasBook(true);

      book.locations.generate(1024).then(() => {
        if (renditionRef.current) {
          const loc = renditionRef.current.currentLocation();
          if (loc && loc.start) {
            api?.sendProgressUpdate({ progress: loc.start.percentage || 0 });
          }
        }
      });
    },
    [style, applyStyle]
  );

  useEffect(() => {
    if (!api) return;

    api.getStyle().then((s) => {
      if (s) setStyle(s);
    });

    api.onEpubOpened((data) => {
      currentBookIdRef.current = data.filePath;
      loadBook(data.base64);
    });

    api.onStyleUpdate((s) => {
      setStyle(s);
      if (renditionRef.current) {
        applyStyle(renditionRef.current, s);
      }
    });

    api.onNavigate((direction) => {
      if (!renditionRef.current) return;
      if (direction === 'next') renditionRef.current.next();
      else if (direction === 'prev') renditionRef.current.prev();
    });

    api.onBookmarkGoto((cfi) => {
      if (renditionRef.current) {
        renditionRef.current.display(cfi);
      }
    });

    api.onQuickBookmark(async () => {
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

  const textureMap = {
    parchment: 'linear-gradient(135deg, #f5e6d0 0%, #e8d5b7 50%, #f0dfc4 100%)',
    paper: 'linear-gradient(180deg, #fefefe 0%, #f5f5f0 50%, #fafaf5 100%)',
    linen: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
    'dark-wood': 'linear-gradient(135deg, #3e2723 0%, #4e342e 50%, #3e2723 100%)',
  };

  const bgStyle = {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundTexture ? textureMap[style.backgroundTexture] : 'none',
    opacity: style.opacity,
  };

  return (
    <div className="widget" style={bgStyle}>
      <div className="widget-titlebar">
        <span className="widget-drag-hint">&#x2807;</span>
        <div className="widget-nav">
          <button onClick={handlePrev} title="Previous">&#x2190;</button>
          <button onClick={handleNext} title="Next">&#x2192;</button>
          <button onClick={handleHide} title="Hide (Ctrl+Shift+R)">&#x2715;</button>
        </div>
      </div>
      {!hasBook && (
        <div className="empty-widget">
          <p>Open an epub from the main window</p>
        </div>
      )}
      <div className="reader-container" ref={viewerRef} />
    </div>
  );
}
