/**
 * Debug API Route: Check Environment Variables
 * GET /api/debug/env
 *
 * 用于调试环境变量是否正确加载
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  // 显示所有 ANTHROPIC_ 和 LLM_PROVIDER 环境变量
  const envVars = {
    ANTHROPIC_BASE_URL: process.env['ANTHROPIC_BASE_URL'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ? process.env['ANTHROPIC_API_KEY'].substring(0, 10) + '...' : undefined,
    ANTHROPIC_AUTH_TOKEN: process.env['ANTHROPIC_AUTH_TOKEN'] ? process.env['ANTHROPIC_AUTH_TOKEN'].substring(0, 10) + '...' : undefined,
    ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'],
    LLM_PROVIDER: process.env['LLM_PROVIDER'],
    OPENAI_BASE_URL: process.env['OPENAI_BASE_URL'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ? process.env['OPENAI_API_KEY'].substring(0, 10) + '...' : undefined,
    OPENAI_MODEL: process.env['OPENAI_MODEL'],
  };

  return NextResponse.json({
    success: true,
    envVars,
    timestamp: new Date().toISOString(),
  });
}
