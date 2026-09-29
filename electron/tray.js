const { Tray, Menu, nativeImage } = require('electron');

function createTrayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = size / 2;
      const cy = size / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < 6) {
        canvas[idx] = 233;     // R
        canvas[idx + 1] = 69;  // G
        canvas[idx + 2] = 96;  // B
        canvas[idx + 3] = 255; // A
      } else if (dist < 7) {
        canvas[idx] = 200;
        canvas[idx + 1] = 50;
        canvas[idx + 2] = 80;
        canvas[idx + 3] = 128;
      } else {
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function setupTray(mainWindow, widgetWindow) {
  const icon = createTrayIcon();
  const tray = new Tray(icon);

  const updateMenu = () => {
    const isWidgetVisible = widgetWindow && widgetWindow.isVisible();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isWidgetVisible ? 'Hide Widget' : 'Show Widget',
        click: () => {
          if (!widgetWindow) return;
          if (widgetWindow.isVisible()) {
            widgetWindow.hide();
          } else {
            widgetWindow.show();
          }
          updateMenu();
        },
      },
      {
        label: 'Open Main Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          const { app } = require('electron');
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('Epub Reader');
  updateMenu();

  tray.on('click', () => {
    if (widgetWindow) {
      if (widgetWindow.isVisible()) {
        widgetWindow.hide();
      } else {
        widgetWindow.show();
      }
      updateMenu();
    }
  });

  return tray;
}

module.exports = { setupTray };
