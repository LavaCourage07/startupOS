import { NextResponse } from 'next/server';
import { readUserConfigWithProductDefaults, updateUserConfig } from '@originos/core/lib/features/user-config';

export async function GET() {
  try {
    const config = readUserConfigWithProductDefaults();
    return NextResponse.json({ success: true, data: config, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const patch = await request.json();
    const updated = updateUserConfig(patch);
    return NextResponse.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
      { status: 500 }
    );
  }
}
