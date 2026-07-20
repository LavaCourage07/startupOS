/**
 * API Route: Validate Ontology Graph
 * GET /api/ontology/validate
 *
 * Validates the ontology graph against schema constraints
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import { ontologyStorage } from '@originos/core/lib/features/ontology/storage';

export async function GET(_request: NextRequest) {
  try {
    const errors = ontologyStorage.validateGraph();

    // Additional schema validation
    const entities = ontologyStorage.listEntities();

    // Validate Task entities have required fields
    for (const entity of entities) {
      if (entity.type === 'Task') {
        if (!entity.properties['title']) {
          errors.push(`${entity.id}: missing required property 'title'`);
        }
        if (!entity.properties['status']) {
          errors.push(`${entity.id}: missing required property 'status'`);
        }
      }

      if (entity.type === 'Project') {
        if (!entity.properties['name']) {
          errors.push(`${entity.id}: missing required property 'name'`);
        }
      }

      if (entity.type === 'Person') {
        if (!entity.properties['name']) {
          errors.push(`${entity.id}: missing required property 'name'`);
        }
      }

      if (entity.type === 'Goal') {
        if (!entity.properties['description']) {
          errors.push(`${entity.id}: missing required property 'description'`);
        }
      }
    }

    // Validate Task status transitions
    const taskEntities = entities.filter((e) => e.type === 'Task');

    const validStatuses = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];
    for (const entity of taskEntities) {
      const status = entity.properties['status'] as string;
      if (status && !validStatuses.includes(status)) {
        errors.push(`${entity.id}: invalid status '${status}'`);
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: errors.length === 0,
        data: errors,
        timestamp: new Date().toISOString(),
      },
      errors.length === 0 ? { status: 200 } : { status: 400 },
    );
  } catch (error) {
    console.error('Error validating ontology graph:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
