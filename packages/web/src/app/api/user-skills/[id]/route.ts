/**
 * API Route: Delete User Skill
 * DELETE /api/user-skills/{id} - Delete a user-created skill from data/skills/
 */

import { NextResponse } from 'next/server';
import { deleteUserSkill } from '@originos/core/lib/features/user-registry';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = deleteUserSkill(params.id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Skill "${params.id}" not found`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { skillId: params.id },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error deleting user skill:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
