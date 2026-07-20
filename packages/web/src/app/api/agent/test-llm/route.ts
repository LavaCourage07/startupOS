/**
 * API Route: Test LLM Configuration
 * GET /api/agent/test-llm
 *
 * Tests the LLM configuration and returns diagnostic info
 * Tests multiple authentication methods and API formats to help diagnose router compatibility
 */

import { NextResponse } from 'next/server';
import http from 'http';
import {
  getAnthropicApiKey,
  getAnthropicBaseUrl,
  getAnthropicModelId,
  getConfigStatus,
} from '@originos/core/lib/integrations/pi-agent/server-config';

/**
 * Test OpenAI-compatible API endpoint using native http module
 * (More reliable than fetch in some environments)
 * NOTE: Uses SDK-style URL (baseURL/chat/completions), not (baseURL/v1/chat/completions)
 */
async function testOpenAIDirect(
  baseUrl: string,
  apiKey: string,
  modelId: string,
): Promise<{ status: string; response: unknown }> {
  return new Promise((resolve) => {
    // OpenAI SDK appends /chat/completions to baseUrl
    // So if baseUrl already includes /v1, the final URL will be /v1/chat/completions
    // If baseUrl does NOT include /v1, we need to add it here for testing
    const urlPath = baseUrl.includes('/v1') ? '/chat/completions' : '/v1/chat/completions';
    const url = new URL(`${baseUrl}${urlPath}`);
    const data = JSON.stringify({
      model: modelId || 'glm-4.7-no-think',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            resolve({
              status: `http_${res.statusCode}`,
              response: {
                type: 'chat.completion',
                hasContent: !!parsed.choices?.[0]?.message?.content,
                model: parsed.model,
                usage: parsed.usage,
              },
            });
          } catch {
            resolve({
              status: `http_${res.statusCode}`,
              response: { error: 'Invalid JSON response', body: body.slice(0, 200) },
            });
          }
        } else {
          resolve({
            status: `http_${res.statusCode || 'unknown'}`,
            response: { error: body.slice(0, 200) },
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        status: 'connection_failed',
        response: { error: e.message },
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'timeout',
        response: { error: 'Request timed out after 15 seconds' },
      });
    });

    req.write(data);
    req.end();
  });
}

/**
 * Test Anthropic-style API endpoint (/v1/messages)
 * NOTE: Uses SDK-style URL construction - if baseUrl includes /v1, append /messages
 */
async function testAnthropicEndpoint(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  authMethod: 'x-api-key' | 'bearer' | 'authorization',
): Promise<{ status: string; response: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (authMethod === 'x-api-key') {
    headers['x-api-key'] = apiKey;
  } else if (authMethod === 'bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['Authorization'] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // SDK-style URL: if baseUrl includes /v1, append /messages only
    const urlPath = baseUrl.includes('/v1') ? '/messages' : '/v1/messages';
    const response = await fetch(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId || 'claude-sonnet-4-6',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        status: `http_${response.status}`,
        response: {
          type: data.type,
          hasContent: !!data.content,
          contentLength: data.content?.length || 0,
        },
      };
    } else {
      const errorText = await response.text();
      return {
        status: `http_${response.status}`,
        response: { error: errorText.slice(0, 200) },
      };
    }
  } catch (error) {
    return {
      status: 'connection_failed',
      response: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Test OpenAI-compatible API endpoint (/v1/chat/completions)
 * NOTE: Uses SDK-style URL construction - if baseUrl includes /v1, append /chat/completions
 */
async function testOpenAIEndpoint(
  baseUrl: string,
  apiKey: string,
  modelId: string,
): Promise<{ status: string; response: unknown }> {
  try {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // OpenAI SDK appends /chat/completions to baseUrl
    // So if baseUrl already includes /v1, the final URL will be /v1/chat/completions
    const urlPath = baseUrl.includes('/v1') ? '/chat/completions' : '/v1/chat/completions';
    const response = await fetch(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId || 'glm-4.7-no-think',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        status: `http_${response.status}`,
        response: {
          type: 'chat.completion',
          hasContent: !!data.choices?.[0]?.message?.content,
          model: data.model,
          usage: data.usage,
        },
      };
    } else {
      const errorText = await response.text();
      return {
        status: `http_${response.status}`,
        response: { error: errorText.slice(0, 200) },
      };
    }
  } catch (error) {
    return {
      status: 'connection_failed',
      response: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

export async function GET() {
  const configStatus = getConfigStatus();
  const apiKey = getAnthropicApiKey();
  const baseUrl = getAnthropicBaseUrl();
  const modelId = getAnthropicModelId()?.trim(); // Trim whitespace

  // Mask API key for security
  const maskedKey = apiKey
    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
    : undefined;

  // Token format analysis
  const tokenAnalysis = {
    length: apiKey?.length || 0,
    prefix: apiKey?.slice(0, 10) || '',
    isOAuthFormat: apiKey?.includes('sk-ant-oat') || false,
    isApiKeyFormat: apiKey?.startsWith('sk-ant-api') || false,
    isCustomFormat: apiKey ? !apiKey.includes('sk-ant-oat') && !apiKey.startsWith('sk-ant-api') : false,
  };

  // Test results
  const endpointTests: Record<string, { status: string; response: unknown }> = {};

  if (configStatus.hasAnthropicKey && configStatus.hasAnthropicBaseUrl) {
    // Test OpenAI-compatible endpoint using native http (most reliable)
    endpointTests['openai-direct-http'] = await testOpenAIDirect(
      baseUrl!,
      apiKey!,
      modelId || 'glm-4.7-no-think',
    );

    // Also test with fetch for comparison
    endpointTests['openai-fetch'] = await testOpenAIEndpoint(
      baseUrl!,
      apiKey!,
      modelId || 'glm-4.7-no-think',
    );

    // Test Anthropic endpoint with different auth methods
    endpointTests['anthropic-x-api-key'] = await testAnthropicEndpoint(
      baseUrl!,
      apiKey!,
      modelId || 'claude-sonnet-4-6',
      'x-api-key',
    );

    endpointTests['anthropic-bearer'] = await testAnthropicEndpoint(
      baseUrl!,
      apiKey!,
      modelId || 'claude-sonnet-4-6',
      'bearer',
    );
  }

  // Determine best working endpoint
  let workingEndpoint: string | null = null;
  for (const [endpoint, result] of Object.entries(endpointTests)) {
    if (result.status === 'http_200' || result.status.startsWith('http_2')) {
      workingEndpoint = endpoint;
      break;
    }
  }

  // Diagnosis
  let diagnosis = '';
  if (workingEndpoint) {
    if (workingEndpoint.startsWith('openai')) {
      diagnosis = `WORKING: OpenAI-compatible endpoint works. Set LLM_PROVIDER=openai-compatible to use this endpoint.`;
    } else {
      diagnosis = `WORKING: Anthropic endpoint works with ${workingEndpoint}.`;
    }
  } else {
    const allFailed = Object.values(endpointTests).every(
      (r) => r.status === 'connection_failed' || r.status === 'timeout' || r.status.startsWith('http_5'),
    );
    if (allFailed) {
      diagnosis = 'UPSTREAM_ERROR: The router is unable to connect to its upstream service. This is a server-side issue with the router.';
    } else {
      diagnosis = 'No working endpoint found. Check token format and router configuration.';
    }
  }

  return NextResponse.json({
    config: {
      hasAnthropicKey: configStatus.hasAnthropicKey,
      hasAnthropicBaseUrl: configStatus.hasAnthropicBaseUrl,
      hasGoogleKey: configStatus.hasGoogleKey,
      isOAuth: configStatus.isOAuth,
      defaultProvider: configStatus.defaultProvider,
      useOpenAICompatible: configStatus.useOpenAICompatible,
      llmProvider: configStatus.llmProvider,
      maskedKey,
      baseUrl,
      modelId,
    },
    tokenAnalysis,
    endpointTests,
    workingEndpoint,
    recommendedProvider: workingEndpoint?.startsWith('openai') ? 'openai-compatible' : 'anthropic',
    diagnosis,
    timestamp: new Date().toISOString(),
  });
}
