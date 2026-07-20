# Electron Icons

Place desktop distribution icons here.

Expected files:
- `tray-icon.png`
- `tray-iconTemplate.png`

Runtime rules:
- Electron tray icons are loaded from `resources/icons/` in development.
- Packaged builds load the same files from `process.resourcesPath/resources/icons/`.
- Frontend app icons remain in `src/styles/icon/`; do not move renderer SVG assets into this directory.
