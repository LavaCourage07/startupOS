"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalUserLanguage = getGlobalUserLanguage;
exports.buildGlobalUserPreferencesPrompt = buildGlobalUserPreferencesPrompt;
exports.appendGlobalUserPreferencesPrompt = appendGlobalUserPreferencesPrompt;
const user_config_1 = require("../../features/user-config");
function languageLabel(language) {
    switch (language) {
        case 'en-US':
            return 'English';
        case 'ja-JP':
            return '日本語';
        case 'zh-CN':
        default:
            return '简体中文';
    }
}
function getGlobalUserLanguage() {
    const config = (0, user_config_1.readUserConfig)();
    const language = config.preferences?.language;
    if (language === 'en-US' || language === 'ja-JP' || language === 'zh-CN') {
        return language;
    }
    return 'zh-CN';
}
function buildGlobalUserPreferencesPrompt() {
    const language = getGlobalUserLanguage();
    return [
        '## Global User Preferences',
        '',
        `- Preferred response language: ${languageLabel(language)} (\`${language}\`)`,
        '- Unless the user explicitly requests another language, respond in the preferred language above.',
        '- Keep terminology, summaries, clarifications, and final answers consistent with this language preference.',
    ].join('\n');
}
function appendGlobalUserPreferencesPrompt(prompt) {
    const block = buildGlobalUserPreferencesPrompt();
    if (!prompt.trim()) {
        return block;
    }
    return `${prompt}\n\n---\n\n${block}`;
}
