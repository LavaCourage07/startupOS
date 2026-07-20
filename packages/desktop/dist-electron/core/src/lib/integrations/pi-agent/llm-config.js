"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRuntimeLLMConfig = normalizeRuntimeLLMConfig;
exports.normalizeRuntimeLLMFieldMapping = normalizeRuntimeLLMFieldMapping;
exports.normalizeCredentialString = normalizeCredentialString;
exports.runtimeLLMConfigToWorkerModel = runtimeLLMConfigToWorkerModel;
function normalizeRuntimeLLMConfig(config) {
    if (!config)
        return undefined;
    if (config.enabled === false)
        return undefined;
    const provider = config.provider === 'openai'
        ? 'openai-compatible'
        : config.provider?.trim() || undefined;
    const baseUrl = (provider === 'anthropic'
        ? config.anthropicBaseUrl || config.baseUrl
        : config.baseUrl)?.trim() || undefined;
    const anthropicAuthToken = normalizeCredentialString(config.anthropicAuthToken);
    const anthropicApiKey = normalizeCredentialString(config.anthropicApiKey);
    const legacyAuthToken = normalizeCredentialString(config.authToken);
    const legacyApiKey = normalizeCredentialString(config.apiKey);
    const explicitSource = provider === 'anthropic'
        ? config.anthropicCredentialSource
        : undefined;
    const authToken = provider === 'anthropic'
        ? explicitSource === 'anthropicApiKey' || explicitSource === 'apiKey'
            ? legacyAuthToken
            : anthropicAuthToken || legacyAuthToken
        : legacyAuthToken;
    const apiKey = provider === 'anthropic'
        ? explicitSource === 'anthropicAuthToken' || explicitSource === 'authToken'
            ? legacyApiKey
            : anthropicApiKey || legacyApiKey
        : legacyApiKey;
    const model = config.model?.trim() || undefined;
    const maxTokens = config.maxTokens && Number.isFinite(config.maxTokens)
        ? config.maxTokens
        : undefined;
    const mapping = normalizeRuntimeLLMFieldMapping(config.mapping);
    if (!provider && !baseUrl && !authToken && !apiKey && !model && !maxTokens && !mapping) {
        return undefined;
    }
    return {
        ...(provider ? { provider } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(provider === 'anthropic' && baseUrl ? { anthropicBaseUrl: baseUrl } : {}),
        ...(authToken ? { authToken } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(provider === 'anthropic' && typeof config.anthropicAuthToken === 'string'
            ? { anthropicAuthToken }
            : {}),
        ...(provider === 'anthropic' && typeof config.anthropicApiKey === 'string'
            ? { anthropicApiKey }
            : {}),
        ...(provider === 'anthropic'
            ? {
                anthropicCredentialSource: explicitSource
                    || (typeof config.anthropicAuthToken === 'string'
                        ? 'anthropicAuthToken'
                        : typeof config.anthropicApiKey === 'string'
                            ? 'anthropicApiKey'
                            : authToken
                                ? 'authToken'
                                : apiKey
                                    ? 'apiKey'
                                    : undefined),
            }
            : {}),
        ...(model ? { model } : {}),
        ...(maxTokens ? { maxTokens } : {}),
        ...(mapping ? { mapping } : {}),
    };
}
function normalizeRuntimeLLMFieldMapping(mapping) {
    if (!mapping || typeof mapping !== 'object')
        return undefined;
    const entries = Object.entries(mapping)
        .map(([source, target]) => [source.trim(), target.trim()])
        .filter(([source, target]) => source.length > 0 && target.length > 0);
    if (entries.length === 0)
        return undefined;
    return Object.fromEntries(entries);
}
function normalizeCredentialString(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
        return stripBearerPrefix(trimmed);
    try {
        const parsed = JSON.parse(trimmed);
        const candidate = extractCredentialValue(parsed);
        return candidate ? stripBearerPrefix(candidate) : stripBearerPrefix(trimmed);
    }
    catch {
        return stripBearerPrefix(trimmed);
    }
}
function extractCredentialValue(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        const enabledEntry = value.find((item) => {
            return Boolean(item)
                && typeof item === 'object'
                && 'enabled' in item
                && item.enabled !== false;
        });
        return extractCredentialValue(enabledEntry ?? value[0]);
    }
    if (value && typeof value === 'object') {
        const record = value;
        if (typeof record['value'] === 'string')
            return record['value'];
        if (typeof record['apiKey'] === 'string')
            return record['apiKey'];
        if (typeof record['authToken'] === 'string')
            return record['authToken'];
        if (typeof record['key'] === 'string')
            return record['key'];
    }
    return undefined;
}
function stripBearerPrefix(value) {
    return value.trim().replace(/^Bearer\s+/i, '').trim();
}
function runtimeLLMConfigToWorkerModel(config) {
    const normalized = normalizeRuntimeLLMConfig(config);
    if (!normalized)
        return undefined;
    return {
        ...normalized,
        ...(normalized.model ? { id: normalized.model } : {}),
    };
}
