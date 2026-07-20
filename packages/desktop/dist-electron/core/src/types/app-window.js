"use strict";
/**
 * OS.9: 应用窗口系统类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINDOW_ZINDEX_STEP = exports.WINDOW_ZINDEX_BASE = exports.DEFAULT_WINDOW_POSITION = exports.DEFAULT_WINDOW_CONSTRAINTS = void 0;
// ============ 默认值 ============
exports.DEFAULT_WINDOW_CONSTRAINTS = {
    minWidth: 400,
    minHeight: 300,
    maxWidth: 1920,
    maxHeight: 1080,
    allowResize: true,
    allowDrag: true,
    allowMinimize: true,
    allowMaximize: true,
    allowFullscreen: false,
    keepInBounds: true,
};
exports.DEFAULT_WINDOW_POSITION = {
    width: 800,
    height: 600,
    zIndex: 100,
};
exports.WINDOW_ZINDEX_BASE = 100;
exports.WINDOW_ZINDEX_STEP = 10;
