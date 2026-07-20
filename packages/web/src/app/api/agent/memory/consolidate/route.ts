/**
 * API Route: Memory Consolidation
 * POST /api/agent/memory/consolidate
 *
 * Called when an agent/project window is closed.
 * Analyzes recent conversation history and updates Memory.md blocks.
 * Fire-and-forget — does not block window close.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { MemoryConsolidator } from '@originos/core/modules/memory-core/core/consolidator';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

const ENTRY_TYPE_DIRS: Record<string, string> = {
  project: 'projects',
  solution: 'projects',
  agent: 'agents',
  'role-agent': 'agents',
  skill: 'skills',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryType, entryId } = body as { entryType: string; entryId: string };

    if (!entryType || !entryId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'entryType and entryId are required' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const baseDir = ENTRY_TYPE_DIRS[entryType];
    if (!baseDir) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: `Unknown entryType: ${entryType}` },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const agentDir = path.join(getDataRoot(), baseDir, entryId);
    const consolidator = new MemoryConsolidator(agentDir);
    const result = await consolidator.consolidate();

    return NextResponse.json<ApiResponse<unknown>>({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/agent/memory/consolidate] error:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
