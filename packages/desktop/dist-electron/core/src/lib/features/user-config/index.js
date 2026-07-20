"use strict";
/**
 * 用户配置持久化
 *
 * 统一读写 data/user-config.json，desktop 端和 web 端共享同一份文件。
 * config.ts 的环境变量之上叠加此文件（文件优先级更高）。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readUserConfig = readUserConfig;
exports.readUserConfigWithProductDefaults = readUserConfigWithProductDefaults;
exports.writeUserConfig = writeUserConfig;
exports.updateUserConfig = updateUserConfig;
exports.runtimeLLMConfigToUserLLMConfig = runtimeLLMConfigToUserLLMConfig;
exports.userLLMConfigToRuntimeLLMConfig = userLLMConfigToRuntimeLLMConfig;
exports.persistRuntimeLLMConfig = persistRuntimeLLMConfig;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const paths_1 = require("../../paths");
const llm_config_1 = require("../../integrations/pi-agent/llm-config");
function getConfigFilePath() {
    return path_1.default.join((0, paths_1.getDataRoot)(), 'user-config.json');
}
function readUserConfig() {
    try {
        const filePath = getConfigFilePath();
        if (!(0, fs_1.existsSync)(filePath))
            return {};
        const raw = (0, fs_1.readFileSync)(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function readUserConfigWithProductDefaults() {
    const current = readUserConfig();
    if (current.llm) {
        return current;
    }
    const llm = readProductLLMConfigFromEnv();
    if (!llm) {
        return current;
    }
    return updateUserConfig({ llm });
}
function writeUserConfig(config) {
    const filePath = getConfigFilePath();
    (0, fs_1.mkdirSync)(path_1.default.dirname(filePath), { recursive: true });
    (0, fs_1.writeFileSync)(filePath, JSON.stringify(config, null, 2), 'utf-8');
}
function pruneNullish(value) {
    return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined));
}
function updateUserConfig(patch) {
    const current = readUserConfig();
    const llm = patch.llm ? pruneNullish({ ...current.llm, ...patch.llm }) : current.llm;
    const preferences = patch.preferences
        ? pruneNullish({ ...current.preferences, ...patch.preferences })
        : current.preferences;
    const updated = {
        ...current,
        ...patch,
        llm,
        preferences,
    };
    writeUserConfig(updated);
    return updated;
}
function runtimeLLMConfigToUserLLMConfig(config) {
    const normalized = (0, llm_config_1.normalizeRuntimeLLMConfig)(config);
    if (!normalized)
        return undefined;
    const provider = normalized.provider;
    const isAnthropic = provider === 'anthropic' || !provider;
    const isOpenAICompatible = provider === 'openai-compatible' || provider === 'openai';
    return {
        enabled: normalized.enabled ?? true,
        ...(provider ? { provider } : {}),
        anthropicAuthToken: isAnthropic ? normalized.anthropicAuthToken ?? normalized.authToken ?? null : null,
        anthropicApiKey: isAnthropic ? normalized.anthropicApiKey ?? normalized.apiKey ?? null : null,
        anthropicBaseUrl: isAnthropic ? normalized.anthropicBaseUrl ?? normalized.baseUrl ?? null : null,
        anthropicCredentialSource: isAnthropic ? normalized.anthropicCredentialSource ?? null : null,
        authToken: isAnthropic ? normalized.authToken ?? normalized.anthropicAuthToken ?? null : null,
        apiKey: isOpenAICompatible ? normalized.apiKey ?? null : null,
        baseUrl: isOpenAICompatible ? normalized.baseUrl ?? null : null,
        ...(normalized.model ? { model: normalized.model } : {}),
        ...(normalized.maxTokens ? { maxTokens: normalized.maxTokens } : {}),
        ...(normalized.mapping ? { mapping: normalized.mapping } : {}),
    };
}
function userLLMConfigToRuntimeLLMConfig(config) {
    if (!config)
        return undefined;
    return (0, llm_config_1.normalizeRuntimeLLMConfig)({
        enabled: config.enabled,
        provider: config.provider,
        anthropicAuthToken: config.anthropicAuthToken ?? undefined,
        anthropicApiKey: config.anthropicApiKey ?? undefined,
        anthropicBaseUrl: config.anthropicBaseUrl ?? undefined,
        anthropicCredentialSource: isAnthropicCredentialSource(config.anthropicCredentialSource)
            ? config.anthropicCredentialSource
            : undefined,
        authToken: config.authToken ?? undefined,
        apiKey: config.apiKey ?? undefined,
        baseUrl: config.baseUrl ?? undefined,
        model: config.model,
        maxTokens: config.maxTokens,
        mapping: config.mapping,
    });
}
function persistRuntimeLLMConfig(config) {
    const llm = runtimeLLMConfigToUserLLMConfig(config);
    if (!llm)
        return undefined;
    return updateUserConfig({ llm });
}
function readProductLLMConfigFromEnv() {
    const provider = normalizeProvider(process.env['LLM_PROVIDER']);
    const maxTokens = process.env['LLM_MAX_TOKENS'] ? parseInt(process.env['LLM_MAX_TOKENS'], 10) || undefined : undefined;
    if (provider === 'openai-compatible' || provider === 'openai') {
        const apiKey = readOptionalString(process.env['OPENAI_API_KEY']);
        const baseUrl = readOptionalString(process.env['OPENAI_BASE_URL']);
        const model = readOptionalString(process.env['OPENAI_MODEL']);
        if (!apiKey && !baseUrl && !model) {
            return undefined;
        }
        return pruneNullish({
            enabled: true,
            provider: 'openai-compatible',
            apiKey: apiKey ?? null,
            baseUrl: baseUrl ?? null,
            model: model ?? undefined,
            maxTokens,
        });
    }
    const anthropicAuthToken = readOptionalString(process.env['ANTHROPIC_AUTH_TOKEN'])
        ?? readOptionalString(process.env['ANTHROPIC_OAUTH_TOKEN']);
    const anthropicApiKey = readOptionalString(process.env['ANTHROPIC_API_KEY']);
    const anthropicBaseUrl = readOptionalString(process.env['ANTHROPIC_BASE_URL']);
    const model = readOptionalString(process.env['ANTHROPIC_MODEL']);
    if (!anthropicAuthToken && !anthropicApiKey && !anthropicBaseUrl && !model) {
        return undefined;
    }
    return pruneNullish({
        enabled: true,
        provider: 'anthropic',
        anthropicAuthToken: anthropicAuthToken ?? null,
        anthropicApiKey: anthropicAuthToken ? null : anthropicApiKey ?? null,
        anthropicBaseUrl: anthropicBaseUrl ?? null,
        anthropicCredentialSource: anthropicAuthToken
            ? 'anthropicAuthToken'
            : anthropicApiKey
                ? 'anthropicApiKey'
                : null,
        authToken: anthropicAuthToken ?? null,
        model: model ?? undefined,
        maxTokens,
    });
}
function normalizeProvider(provider) {
    if (provider === 'openai')
        return 'openai-compatible';
    if (provider === 'openai-compatible' || provider === 'anthropic')
        return provider;
    return undefined;
}
function readOptionalString(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
function isAnthropicCredentialSource(value) {
    return value === 'anthropicAuthToken'
        || value === 'anthropicApiKey'
        || value === 'authToken'
        || value === 'apiKey';
}
