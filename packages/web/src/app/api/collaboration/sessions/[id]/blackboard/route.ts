import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { getBlackboardState } = await import("@/modules/collaboration-runtime/facade");
    const state = await getBlackboardState(params.id);
    if (!state) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: state });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get blackboard" },
      { status: 500 }
    );
  }
}
