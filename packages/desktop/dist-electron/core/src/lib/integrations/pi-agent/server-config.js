"use strict";
/**
 * Pi Agent 服务端配置
 * 仅在服务端使用，包含 @mariozechner/pi-ai 的模型创建功能
 *
 * 注意：此模块只能在服务端使用（API Routes, Server Components 等）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_CONFIG = exports.getLLMMaxTokens = exports.shouldUseOpenAICompatible = exports.injectBrowserConfig = exports.validateConfig = exports.getConfigStatus = exports.getAzureApiFormat = exports.getAzureApiVersion = exports.getAzureDeploymentName = exports.getAzureBaseUrl = exports.getAzureResourceName = exports.getAzureApiKey = exports.getAnthropicModelId = exports.getGoogleApiKey = exports.getAnthropicBaseUrl = exports.getAnthropicApiKeySource = exports.getAnthropicApiKey = void 0;
exports.createAnthropicModel = createAnthropicModel;
exports.createOpenAICompatibleModel = createOpenAICompatibleModel;
exports.createGoogleModel = createGoogleModel;
exports.createAzureModel = createAzureModel;
exports.createAzureChatModel = createAzureChatModel;
exports.createAutoModel = createAutoModel;
exports.createRuntimeModel = createRuntimeModel;
const pi_ai_1 = require("@mariozechner/pi-ai");
const config_1 = require("./config");
const llm_config_1 = require("./llm-config");
// ============================================================================
// 模型创建（服务端专用）
// ============================================================================
/**
 * 创建 Anthropic 模型配置
 * 仅在服务端使用
 */
function createAnthropicModel(modelId, options) {
    const actualModelId = modelId || (0, config_1.getAnthropicModelId)() || config_1.DEFAULT_MODEL_CONFIG.anthropic.defaultModel;
    const baseUrl = options?.baseUrl || (0, config_1.getAnthropicBaseUrl)();
    const apiKey = options?.apiKey || (0, config_1.getAnthropicApiKey)();
    const credentialSource = options?.credentialSource || (options?.apiKey ? "runtime.options.apiKey" : (0, config_1.getAnthropicApiKeySource)());
    const baseModel = (0, pi_ai_1.getModel)("anthropic", actualModelId);
    // 如果模型不在注册表中（自定义模型名如 GLM），创建自定义模型配置
    if (!baseModel) {
        const customModel = {
            id: actualModelId,
            name: actualModelId,
            api: "anthropic-messages",
            provider: "anthropic",
            ...(baseUrl && { baseUrl }),
            ...(apiKey && { apiKey }),
            // API key 认证时显式禁用 authToken，防止 SDK 从环境变量读取 ANTHROPIC_AUTH_TOKEN
            authToken: null,
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 16384,
        };
        return applyAnthropicCredentialMetadata(customModel, apiKey, credentialSource);
    }
    if (baseUrl || apiKey) {
        const model = { ...baseModel, ...(baseUrl && { baseUrl }), ...(apiKey && { apiKey }), authToken: null };
        return applyAnthropicCredentialMetadata(model, apiKey, credentialSource);
    }
    return baseModel;
}
function applyAnthropicCredentialMetadata(model, credential, source) {
    if (!credential)
        return model;
    // 优先用 token 值判断：sk-ant-oat 开头才是真正的 OAuth token
    // source 字符串不可靠（env.ANTHROPIC_AUTH_TOKEN 可能是普通 bearer token）
    const isOAuth = credential.startsWith("sk-ant-oat");
    const credentialAuthMode = isAnthropicAuthTokenSource(source)
        ? "bearer"
        : isOAuth
            ? "oauth"
            : "api-key";
    const shouldUseAuthToken = credentialAuthMode === "bearer" || credentialAuthMode === "oauth";
    return {
        ...model,
        apiKey: shouldUseAuthToken ? null : credential,
        authToken: shouldUseAuthToken ? credential : null,
        credentialSource: source || "unknown",
        credentialAuthMode,
    };
}
function isAnthropicAuthTokenSource(source) {
    if (!source)
        return false;
    const normalized = source.toLowerCase().replace(/_/g, "");
    return normalized.endsWith("anthropicauthtoken")
        || normalized.endsWith("authtoken")
        || normalized.endsWith("anthropicoauthtoken");
}
function isAnthropicApiKeySource(source) {
    if (!source)
        return false;
    const normalized = source.toLowerCase().replace(/_/g, "");
    return normalized.endsWith("anthropicapikey")
        || normalized.endsWith("apikey");
}
/**
 * 创建 OpenAI 兼容模型配置
 * 用于支持 OpenAI API 兼容的路由服务（如 GLM、Qwen 等）
 */
function createOpenAICompatibleModel(modelId, options) {
    const actualModelId = modelId || (0, config_1.getAnthropicModelId)() || "glm-4.7-no-think";
    let baseUrl = options?.baseUrl || (0, config_1.getAnthropicBaseUrl)() || "";
    // Ensure base URL includes /v1 prefix so the OpenAI SDK's /chat/completions
    // append results in /v1/chat/completions
    if (baseUrl && !baseUrl.includes("/v1")) {
        baseUrl = `${baseUrl.replace(/\/$/, "")}/v1`;
    }
    const apiKey = options?.apiKey || (0, config_1.getAnthropicApiKey)();
    const openAIModel = {
        id: actualModelId,
        name: actualModelId,
        api: "openai-completions",
        provider: "openai",
        baseUrl: baseUrl,
        reasoning: false,
        input: ["text"],
        cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
        },
        contextWindow: 128000,
        maxTokens: 16384,
        ...(apiKey && { apiKey }),
        compat: {
            supportsUsageInStreaming: true,
            maxTokensField: "max_tokens",
            supportsReasoningEffort: false,
            supportsStore: false,
            supportsDeveloperRole: false,
            requiresToolResultName: false,
            requiresAssistantAfterToolResult: false,
            requiresThinkingAsText: false,
            requiresMistralToolIds: false,
            thinkingFormat: "openai",
        },
    };
    return applyRuntimeFieldMapping(openAIModel, options?.mapping);
}
function applyRuntimeFieldMapping(model, mapping) {
    const normalized = (0, llm_config_1.normalizeRuntimeLLMFieldMapping)(mapping);
    if (!normalized)
        return model;
    const modelWithCompat = model;
    const maxTokensField = modelWithCompat.compat?.maxTokensField;
    if (!maxTokensField)
        return model;
    const mappedMaxTokensField = normalized[maxTokensField];
    if (!mappedMaxTokensField)
        return model;
    if (!modelWithCompat.compat)
        return model;
    modelWithCompat.compat.maxTokensField = mappedMaxTokensField;
    return model;
}
/**
 * 创建 Google 模型配置
 * 仅在服务端使用
 */
function createGoogleModel(modelId = config_1.DEFAULT_MODEL_CONFIG.google.defaultModel, options) {
    const apiKey = options?.apiKey || (0, config_1.getGoogleApiKey)();
    const baseModel = (0, pi_ai_1.getModel)("google", modelId);
    if (apiKey) {
        return { ...baseModel, apiKey };
    }
    return baseModel;
}
/**
 * 创建 Azure OpenAI 模型配置
 * 直连 Azure OpenAI Service，无需代理
 *
 * @param deploymentName Azure 部署名（如 gpt-4o、gpt-35-turbo 等）
 * @param options 可选覆盖配置
 */
function createAzureModel(deploymentName, options) {
    const format = options?.apiFormat ?? (0, config_1.getAzureApiFormat)();
    if (format === "chat") {
        return createAzureChatModel(deploymentName, options);
    }
    const actualDeploymentName = deploymentName || (0, config_1.getAzureDeploymentName)();
    const apiKey = options?.apiKey || (0, config_1.getAzureApiKey)();
    const baseUrl = options?.baseUrl || (0, config_1.getAzureBaseUrl)();
    const apiVersion = options?.apiVersion || (0, config_1.getAzureApiVersion)();
    const baseModel = (0, pi_ai_1.getModel)("azure-openai-responses", actualDeploymentName);
    // 如果基础模型不存在，创建自定义
    if (!baseModel) {
        const customModel = {
            id: actualDeploymentName || "gpt-4o",
            name: actualDeploymentName || "gpt-4o",
            api: "azure-openai-responses",
            provider: "azure-openai-responses",
            ...(baseUrl && { baseUrl }),
            ...(apiKey && { apiKey }),
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 16384,
            compat: {
                azureDeploymentName: actualDeploymentName,
                azureApiVersion: apiVersion,
            },
        };
        return customModel;
    }
    // 否则覆盖配置
    const model = { ...baseModel };
    if (apiKey)
        model.apiKey = apiKey;
    if (baseUrl)
        model.baseUrl = baseUrl;
    return model;
}
/**
 * 创建 Azure OpenAI Chat Completions 模型配置
 * 使用 /chat/completions 端点，兼容 gpt-35-turbo、gpt-4 等传统部署
 *
 * 适用场景：Azure 部署不支持 Responses API 时（如 gpt-chat 类型部署）
 *
 * @param deploymentName Azure 部署名
 * @param options 可选覆盖配置
 */
function createAzureChatModel(deploymentName, options) {
    const actualDeploymentName = deploymentName || (0, config_1.getAzureDeploymentName)() || "gpt-4o";
    const apiKey = options?.apiKey || (0, config_1.getAzureApiKey)() || "";
    const apiVersion = options?.apiVersion || (0, config_1.getAzureApiVersion)() || "2024-02-01";
    // 构建 Azure Chat Completions baseUrl
    // 格式：https://{resource}.openai.azure.com/openai/deployments/{deployment}
    // OpenAI client 会自动追加 /chat/completions
    let baseUrl = options?.baseUrl || (0, config_1.getAzureBaseUrl)() || "";
    if (!baseUrl) {
        const resourceName = options?.resourceName || (0, config_1.getAzureResourceName)();
        if (resourceName) {
            baseUrl = `https://${resourceName}.openai.azure.com/openai/deployments/${actualDeploymentName}`;
        }
    }
    else {
        // 如果 baseUrl 不包含 /deployments/，追加部署名路径
        if (!baseUrl.includes("/deployments/")) {
            baseUrl = `${baseUrl.replace(/\/$/, "")}/openai/deployments/${actualDeploymentName}`;
        }
    }
    const chatModel = {
        id: actualDeploymentName,
        name: actualDeploymentName,
        api: "openai-completions",
        provider: "azure-openai",
        baseUrl: `${baseUrl}?api-version=${apiVersion}`,
        apiKey,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384,
        // Azure Chat Completions 用 api-key header 而非 Authorization: Bearer
        headers: { "api-key": apiKey },
        compat: {
            supportsUsageInStreaming: true,
            maxTokensField: "max_tokens",
            supportsReasoningEffort: false,
            supportsStore: false,
            supportsDeveloperRole: false,
            requiresToolResultName: false,
            requiresAssistantAfterToolResult: false,
            requiresThinkingAsText: false,
            requiresMistralToolIds: false,
            thinkingFormat: "openai",
        },
    };
    return chatModel;
}
/**
 * 根据配置自动选择合适的模型
 * 优先使用 OpenAI 兼容 API 如果检测到需要
 */
function createAutoModel(modelId, options) {
    const configStatus = (0, config_1.getConfigStatus)();
    const maxTokens = options?.maxTokens ?? (0, config_1.getLLMMaxTokens)();
    let model;
    // 如果检测到需要 OpenAI 兼容 API
    if (configStatus.useOpenAICompatible || (0, config_1.shouldUseOpenAICompatible)()) {
        model = createOpenAICompatibleModel(modelId, options);
    }
    // Azure OpenAI 直连
    else if (configStatus.hasAzureConfig) {
        model = createAzureModel(modelId);
    }
    // 默认使用 Anthropic
    else if (configStatus.hasAnthropicKey) {
        model = createAnthropicModel(modelId, options);
    }
    // 回退到 Google
    else if (configStatus.hasGoogleKey) {
        model = createGoogleModel(modelId, options);
    }
    // 默认返回 Anthropic 配置
    else {
        model = createAnthropicModel(modelId, options);
    }
    // 应用 maxTokens 覆盖（环境变量或调用方指定）
    if (maxTokens) {
        model.maxTokens = maxTokens;
    }
    return model;
}
/**
 * 根据用户运行时配置显式创建模型。
 *
 * 这里不写入也不读取调用方传入字段对应的环境变量；用户配置字段优先级最高，
 * 只有未提供的字段才允许各 provider 创建函数回退到环境变量。
 */
function createRuntimeModel(llmConfig) {
    llmConfig = (0, llm_config_1.normalizeRuntimeLLMConfig)(llmConfig) ?? llmConfig;
    const modelId = llmConfig.model?.trim() || undefined;
    const provider = llmConfig.provider;
    const anthropicCredentialSource = llmConfig.anthropicCredentialSource;
    const anthropicAuthToken = llmConfig.anthropicAuthToken?.trim() || llmConfig.authToken?.trim() || undefined;
    const anthropicApiKey = llmConfig.anthropicApiKey?.trim() || llmConfig.apiKey?.trim() || undefined;
    const hasAnthropicAuthToken = isAnthropicAuthTokenSource(anthropicCredentialSource);
    const hasAnthropicApiKey = isAnthropicApiKeySource(anthropicCredentialSource);
    const baseUrl = provider === "anthropic" || !provider
        ? llmConfig.anthropicBaseUrl || llmConfig.baseUrl
        : llmConfig.baseUrl;
    // 始终传递凭证到 options.apiKey，确保 createAnthropicModel 在子进程环境变量
    // 被 strip 的情况下也能拿到有效 key（applyAnthropicCredentialMetadata 会后续
    // 按 credentialSource 重新分配 apiKey / authToken）。
    const anthropicOptionCredential = anthropicApiKey || anthropicAuthToken;
    const options = {
        ...(baseUrl ? { baseUrl } : {}),
        ...(provider === "anthropic" || !provider
            ? {
                ...(anthropicOptionCredential ? { apiKey: anthropicOptionCredential } : {}),
            }
            : {
                ...(llmConfig.authToken?.trim() ? { apiKey: llmConfig.authToken.trim() } : {}),
                ...(llmConfig.apiKey?.trim() ? { apiKey: llmConfig.apiKey.trim() } : {}),
            }),
        ...(llmConfig.maxTokens ? { maxTokens: llmConfig.maxTokens } : {}),
        ...(llmConfig.mapping ? { mapping: llmConfig.mapping } : {}),
    };
    const credential = provider === "anthropic" || !provider
        ? anthropicAuthToken || anthropicApiKey
        : llmConfig.authToken?.trim() || llmConfig.apiKey?.trim() || undefined;
    let model;
    if (llmConfig.provider === "openai-compatible" || llmConfig.provider === "openai") {
        model = createOpenAICompatibleModel(modelId, options);
    }
    else if (llmConfig.provider === "azure-openai" || llmConfig.provider === "azure") {
        model = createAzureModel(modelId, {
            apiKey: credential,
            baseUrl,
        });
    }
    else if (llmConfig.provider === "google" || llmConfig.provider === "gemini") {
        model = createGoogleModel(modelId ?? config_1.DEFAULT_MODEL_CONFIG.google.defaultModel, {
            apiKey: credential,
        });
    }
    else if (llmConfig.provider === "anthropic" || !llmConfig.provider) {
        const anthropicModel = createAnthropicModel(modelId, options);
        const normalizedCredentialSource = hasAnthropicAuthToken
            ? "anthropicAuthToken"
            : hasAnthropicApiKey
                ? "anthropicApiKey"
                : (0, config_1.getAnthropicApiKeySource)();
        model = applyAnthropicCredentialMetadata(anthropicModel, anthropicAuthToken || anthropicApiKey, normalizedCredentialSource);
    }
    else {
        model = createAutoModel(modelId, options);
    }
    if (llmConfig.maxTokens) {
        model.maxTokens = llmConfig.maxTokens;
    }
    const debugModel = model;
    const debugCredential = debugModel.apiKey || debugModel.authToken;
    console.error(`[createRuntimeModel] created model:`, {
        id: debugModel.id,
        apiKey: debugCredential ? `${debugCredential.slice(0, 8)}...` : "MISSING",
        authMode: debugModel.authToken ? "bearer" : "api-key",
        baseUrl: debugModel.baseUrl ?? "default",
        provider: llmConfig.provider ?? "anthropic(default)",
    });
    return model;
}
// Re-export types and utilities from config
var config_2 = require("./config");
Object.defineProperty(exports, "getAnthropicApiKey", { enumerable: true, get: function () { return config_2.getAnthropicApiKey; } });
Object.defineProperty(exports, "getAnthropicApiKeySource", { enumerable: true, get: function () { return config_2.getAnthropicApiKeySource; } });
Object.defineProperty(exports, "getAnthropicBaseUrl", { enumerable: true, get: function () { return config_2.getAnthropicBaseUrl; } });
Object.defineProperty(exports, "getGoogleApiKey", { enumerable: true, get: function () { return config_2.getGoogleApiKey; } });
Object.defineProperty(exports, "getAnthropicModelId", { enumerable: true, get: function () { return config_2.getAnthropicModelId; } });
// Azure
Object.defineProperty(exports, "getAzureApiKey", { enumerable: true, get: function () { return config_2.getAzureApiKey; } });
Object.defineProperty(exports, "getAzureResourceName", { enumerable: true, get: function () { return config_2.getAzureResourceName; } });
Object.defineProperty(exports, "getAzureBaseUrl", { enumerable: true, get: function () { return config_2.getAzureBaseUrl; } });
Object.defineProperty(exports, "getAzureDeploymentName", { enumerable: true, get: function () { return config_2.getAzureDeploymentName; } });
Object.defineProperty(exports, "getAzureApiVersion", { enumerable: true, get: function () { return config_2.getAzureApiVersion; } });
Object.defineProperty(exports, "getAzureApiFormat", { enumerable: true, get: function () { return config_2.getAzureApiFormat; } });
// Other
Object.defineProperty(exports, "getConfigStatus", { enumerable: true, get: function () { return config_2.getConfigStatus; } });
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return config_2.validateConfig; } });
Object.defineProperty(exports, "injectBrowserConfig", { enumerable: true, get: function () { return config_2.injectBrowserConfig; } });
Object.defineProperty(exports, "shouldUseOpenAICompatible", { enumerable: true, get: function () { return config_2.shouldUseOpenAICompatible; } });
Object.defineProperty(exports, "getLLMMaxTokens", { enumerable: true, get: function () { return config_2.getLLMMaxTokens; } });
Object.defineProperty(exports, "DEFAULT_MODEL_CONFIG", { enumerable: true, get: function () { return config_2.DEFAULT_MODEL_CONFIG; } });
