"use strict";
/**
 * Pi Agent 配置
 * 支持环境变量配置 API Key 和 Base URL
 *
 * 支持的环境变量:
 * - ANTHROPIC_AUTH_TOKEN: Anthropic auth token (优先级高于 ANTHROPIC_API_KEY)
 * - ANTHROPIC_OAUTH_TOKEN: pi-ai 兼容的 OAuth token 变量名
 * - ANTHROPIC_API_KEY: Anthropic API key (sk-ant-api...)
 * - ANTHROPIC_BASE_URL: Anthropic API base URL (可选，用于代理)
 * - ANTHROPIC_MODEL: Anthropic Model ID (可选，覆盖默认模型)
 * - GOOGLE_API_KEY: Google Gemini API key
 * - GEMINI_API_KEY: Google Gemini API key (备用)
 * - LLM_PROVIDER: LLM 提供商类型 (anthropic, openai-compatible, google)
 *                  设置为 "openai-compatible" 可使用 OpenAI 兼容的 API
 * - LLM_MAX_TOKENS: 最大输出 Token 数（整数，如 4096）
 *
 * 注意：此模块为客户端版本，不依赖 Node.js 特定包
 * 服务端使用 server-config.ts 进行模型创建
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_CONFIG = void 0;
exports.getAnthropicApiKey = getAnthropicApiKey;
exports.getAnthropicApiKeySource = getAnthropicApiKeySource;
exports.getAnthropicBaseUrl = getAnthropicBaseUrl;
exports.getGoogleApiKey = getGoogleApiKey;
exports.isOAuthToken = isOAuthToken;
exports.getAnthropicModelId = getAnthropicModelId;
exports.getAzureApiKey = getAzureApiKey;
exports.getAzureResourceName = getAzureResourceName;
exports.getAzureBaseUrl = getAzureBaseUrl;
exports.getAzureDeploymentName = getAzureDeploymentName;
exports.getAzureApiVersion = getAzureApiVersion;
exports.getAzureApiFormat = getAzureApiFormat;
exports.getLLMProvider = getLLMProvider;
exports.getLLMMaxTokens = getLLMMaxTokens;
exports.shouldUseOpenAICompatible = shouldUseOpenAICompatible;
exports.getConfigStatus = getConfigStatus;
exports.validateConfig = validateConfig;
exports.injectBrowserConfig = injectBrowserConfig;
function readOptionalString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
function maskSecret(value) {
    return value ? `${value.substring(0, 20)}...` : undefined;
}
function isAnthropicOAuthTokenValue(value) {
    return !!value && value.includes("sk-ant-oat");
}
function getAnthropicCredentialSource(config) {
    if (config.anthropicAuthToken)
        return config.anthropicCredentialSource || "env.ANTHROPIC_AUTH_TOKEN";
    if (config.anthropicApiKey)
        return config.anthropicCredentialSource || "env.ANTHROPIC_API_KEY";
    return undefined;
}
// ============================================================================
// 配置读取
// ============================================================================
/**
 * 从环境变量读取配置
 * 支持浏览器和 Node.js 环境
 */
function getEnvConfig() {
    // Node.js 环境
    if (typeof process !== "undefined" && process.env) {
        const config = {
            anthropicAuthToken: process.env['ANTHROPIC_AUTH_TOKEN'] || process.env['ANTHROPIC_OAUTH_TOKEN'],
            anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
            anthropicBaseUrl: process.env['ANTHROPIC_BASE_URL'],
            anthropicCredentialSource: process.env['ANTHROPIC_AUTH_TOKEN']
                ? "env.ANTHROPIC_AUTH_TOKEN"
                : process.env['ANTHROPIC_OAUTH_TOKEN']
                    ? "env.ANTHROPIC_OAUTH_TOKEN"
                    : process.env['ANTHROPIC_API_KEY']
                        ? "env.ANTHROPIC_API_KEY"
                        : undefined,
            anthropicModel: process.env['ANTHROPIC_MODEL'],
            googleApiKey: process.env['GOOGLE_API_KEY'],
            geminiApiKey: process.env['GEMINI_API_KEY'],
            azureApiKey: process.env['AZURE_OPENAI_API_KEY'],
            azureResourceName: process.env['AZURE_OPENAI_RESOURCE_NAME'],
            azureBaseUrl: process.env['AZURE_OPENAI_BASE_URL'],
            azureDeploymentName: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'],
            azureApiVersion: process.env['AZURE_OPENAI_API_VERSION'],
            azureApiFormat: process.env['AZURE_OPENAI_API_FORMAT'] || "responses",
            llmProvider: process.env['LLM_PROVIDER'],
            llmMaxTokens: process.env['LLM_MAX_TOKENS'] ? parseInt(process.env['LLM_MAX_TOKENS'], 10) || undefined : undefined,
        };
        // 叠加 data/user-config.json（文件配置优先级高于环境变量）
        try {
            const { readUserConfig } = require('../../features/user-config');
            const userCfg = readUserConfig();
            const llm = userCfg?.llm;
            if (llm && llm.enabled !== false) {
                const provider = llm.provider === "openai" ? "openai-compatible" : llm.provider;
                const anthropicAuthToken = readOptionalString(llm.anthropicAuthToken) || readOptionalString(llm.authToken);
                const anthropicApiKey = readOptionalString(llm.anthropicApiKey) || readOptionalString(llm.apiKey);
                const anthropicBaseUrl = readOptionalString(llm.anthropicBaseUrl) || readOptionalString(llm.baseUrl);
                const credential = provider === "anthropic" || !provider
                    ? anthropicAuthToken || anthropicApiKey
                    : readOptionalString(llm.apiKey);
                if (credential) {
                    if (provider === "anthropic" || !provider) {
                        config.anthropicAuthToken = anthropicAuthToken || undefined;
                        config.anthropicApiKey = anthropicAuthToken ? undefined : anthropicApiKey;
                        config.anthropicCredentialSource = anthropicAuthToken
                            ? "user.anthropicAuthToken"
                            : "user.anthropicApiKey";
                    }
                    else {
                        config.anthropicApiKey = credential;
                        config.anthropicAuthToken = undefined;
                        config.anthropicCredentialSource = "user.apiKey";
                    }
                }
                if (anthropicBaseUrl)
                    config.anthropicBaseUrl = anthropicBaseUrl;
                if (readOptionalString(llm.model))
                    config.anthropicModel = readOptionalString(llm.model);
                if (provider)
                    config.llmProvider = provider;
                if (llm.maxTokens)
                    config.llmMaxTokens = llm.maxTokens;
            }
        }
        catch {
            // 文件不存在或 JSON 解析失败时静默回退到环境变量
        }
        // 调试日志 - 只在服务端输出，展示 user-config 覆盖后的最终配置
        if (typeof window === "undefined") {
            console.log('[config.ts] getEnvConfig resolved:', {
                anthropicAuthToken: maskSecret(config.anthropicAuthToken),
                anthropicApiKey: maskSecret(config.anthropicApiKey),
                anthropicBaseUrl: config.anthropicBaseUrl,
                anthropicModel: config.anthropicModel,
                anthropicCredentialSource: getAnthropicCredentialSource(config),
                anthropicUsesOAuth: isAnthropicOAuthTokenValue(config.anthropicAuthToken || config.anthropicApiKey),
                azureResourceName: config.azureResourceName,
                azureDeploymentName: config.azureDeploymentName,
                llmProvider: config.llmProvider,
            });
        }
        return config;
    }
    // 浏览器环境 - 从 window.__PI_AGENT_CONFIG__ 读取
    if (typeof window !== "undefined") {
        const config = window.__PI_AGENT_CONFIG__;
        if (config) {
            return {
                anthropicAuthToken: config.ANTHROPIC_AUTH_TOKEN || config.ANTHROPIC_OAUTH_TOKEN,
                anthropicApiKey: config.ANTHROPIC_API_KEY,
                anthropicBaseUrl: config.ANTHROPIC_BASE_URL,
                anthropicModel: config.ANTHROPIC_MODEL,
                googleApiKey: config.GOOGLE_API_KEY,
                geminiApiKey: config.GEMINI_API_KEY,
                llmProvider: config.LLM_PROVIDER,
                llmMaxTokens: config.LLM_MAX_TOKENS ? parseInt(config.LLM_MAX_TOKENS, 10) || undefined : undefined,
            };
        }
    }
    return {};
}
// ============================================================================
// 模型配置
// ============================================================================
/**
 * 默认模型配置
 */
exports.DEFAULT_MODEL_CONFIG = {
    anthropic: {
        defaultModel: "claude-sonnet-4-6",
        models: [
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
        ],
    },
    google: {
        defaultModel: "gemini-2.5-pro-preview-06-05",
        models: [
            "gemini-2.5-pro-preview-06-05",
            "gemini-2.5-flash-preview-05-20",
        ],
    },
};
/**
 * 获取 Anthropic API Key
 * 优先级: ANTHROPIC_AUTH_TOKEN > ANTHROPIC_API_KEY
 */
function getAnthropicApiKey() {
    const env = getEnvConfig();
    return env.anthropicAuthToken || env.anthropicApiKey;
}
/**
 * 获取 Anthropic credential 来源
 */
function getAnthropicApiKeySource() {
    const env = getEnvConfig();
    return getAnthropicCredentialSource(env);
}
/**
 * 获取 Anthropic Base URL
 */
function getAnthropicBaseUrl() {
    const env = getEnvConfig();
    return env.anthropicBaseUrl;
}
/**
 * 获取 Google API Key
 */
function getGoogleApiKey() {
    const env = getEnvConfig();
    return env.googleApiKey || env.geminiApiKey;
}
/**
 * 检查是否使用 OAuth Token
 */
function isOAuthToken() {
    return isAnthropicOAuthTokenValue(getAnthropicApiKey());
}
/**
 * 获取 Anthropic 模型 ID
 */
function getAnthropicModelId() {
    const env = getEnvConfig();
    return env.anthropicModel?.trim();
}
/**
 * 获取 Azure OpenAI API Key
 */
function getAzureApiKey() {
    const env = getEnvConfig();
    return env.azureApiKey;
}
/**
 * 获取 Azure OpenAI Resource Name
 */
function getAzureResourceName() {
    const env = getEnvConfig();
    return env.azureResourceName;
}
/**
 * 获取 Azure OpenAI Base URL
 */
function getAzureBaseUrl() {
    const env = getEnvConfig();
    return env.azureBaseUrl;
}
/**
 * 获取 Azure OpenAI Deployment Name
 */
function getAzureDeploymentName() {
    const env = getEnvConfig();
    return env.azureDeploymentName;
}
/**
 * 获取 Azure OpenAI API Version
 */
function getAzureApiVersion() {
    const env = getEnvConfig();
    return env.azureApiVersion;
}
/**
 * 获取 Azure OpenAI API Format
 * "responses" = Responses API（默认，较新）
 * "chat" = Chat Completions API（兼容 gpt-chat 等传统部署）
 */
function getAzureApiFormat() {
    const env = getEnvConfig();
    return env.azureApiFormat || "responses";
}
/**
 * 获取 LLM Provider 类型
 * 返回: "anthropic", "openai-compatible", 或 "google"
 */
function getLLMProvider() {
    const env = getEnvConfig();
    return env.llmProvider || "anthropic";
}
/**
 * 检测是否应该使用 OpenAI 兼容 API
 * 基于环境变量或自动检测
 */
function getLLMMaxTokens() {
    const env = getEnvConfig();
    return env.llmMaxTokens;
}
function shouldUseOpenAICompatible() {
    const env = getEnvConfig();
    // 显式设置 LLM_PROVIDER 时，严格遵循
    if (env.llmProvider === "openai-compatible") {
        return true;
    }
    // 如果显式设置为 anthropic，则不使用 OpenAI 兼容
    if (env.llmProvider === "anthropic") {
        return false;
    }
    // 自动检测：如果有 baseUrl 且 key 不是 Anthropic 格式，且模型不是 Claude
    const credential = env.anthropicAuthToken || env.anthropicApiKey;
    if (env.anthropicBaseUrl && credential) {
        const isCustomToken = !credential.includes("sk-ant-oat") && !credential.startsWith("sk-ant-api");
        const model = env.anthropicModel || "";
        const isNonClaudeModel = model.includes("glm") ||
            model.includes("gpt") ||
            model.includes("qwen") ||
            (model.length > 0 && !model.includes("claude"));
        if (isCustomToken && isNonClaudeModel) {
            return true;
        }
    }
    return false;
}
/**
 * 获取配置状态
 */
function getConfigStatus() {
    const env = getEnvConfig();
    const hasAnthropicKey = !!(env.anthropicAuthToken || env.anthropicApiKey);
    const hasAnthropicBaseUrl = !!env.anthropicBaseUrl;
    const hasGoogleKey = !!(env.googleApiKey || env.geminiApiKey);
    const hasAzureKey = !!env.azureApiKey;
    const hasAzureConfig = hasAzureKey && !!(env.azureResourceName || env.azureBaseUrl);
    const isOAuth = !!env.anthropicAuthToken;
    const llmProvider = getLLMProvider();
    const useOpenAICompatible = shouldUseOpenAICompatible();
    let defaultProvider = "none";
    if (llmProvider === "azure-openai")
        defaultProvider = "azure";
    else if (hasAnthropicKey)
        defaultProvider = "anthropic";
    else if (hasGoogleKey)
        defaultProvider = "google";
    else if (hasAzureKey)
        defaultProvider = "azure";
    return {
        hasAnthropicKey,
        hasAnthropicBaseUrl,
        hasGoogleKey,
        hasAzureKey,
        hasAzureConfig,
        isOAuth,
        defaultProvider,
        useOpenAICompatible,
        llmProvider,
    };
}
/**
 * 验证配置
 */
function validateConfig() {
    const errors = [];
    const warnings = [];
    const status = getConfigStatus();
    if (!status.hasAnthropicKey && !status.hasGoogleKey) {
        errors.push("未配置 API Key。请设置 ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY 环境变量。");
    }
    if (status.hasAnthropicBaseUrl) {
        warnings.push("已配置自定义 ANTHROPIC_BASE_URL，请确保代理服务可用。");
    }
    return { errors, warnings };
}
/**
 * 在浏览器环境中注入配置
 */
function injectBrowserConfig(config) {
    if (typeof window !== "undefined") {
        window.__PI_AGENT_CONFIG__ = config;
    }
}
