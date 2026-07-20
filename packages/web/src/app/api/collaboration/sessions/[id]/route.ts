import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { getSession, getBlackboardState } = await import("@/modules/collaboration-runtime/facade");
    const session = await getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const blackboard = await getBlackboardState(params.id);

    return NextResponse.json({
      success: true,
      data: { session, blackboard },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get session" },
      { status: 500 }
    );
  }
}
