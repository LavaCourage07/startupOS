import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { abortSession } = await import("@/modules/collaboration-runtime/facade");
    await abortSession(params.id);
    return NextResponse.json({ success: true, data: { status: "aborted" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to abort session" },
      { status: 500 }
    );
  }
}
