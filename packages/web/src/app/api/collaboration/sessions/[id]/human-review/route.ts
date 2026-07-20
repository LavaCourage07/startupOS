import { NextResponse } from "next/server";

/**
 * POST /api/collaboration/sessions/[id]/human-review
 *
 * @deprecated Story 9.34 — 此路由已废弃。用户回复统一路由到 Supervisor。
 * 请使用 POST /api/collaboration/sessions/[id]/messages { to: "supervisor", message: "..." }。
 * 此路由保留向后兼容，内部委托 respondToHumanReview → sendMessageToSupervisor。
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const raw: unknown = await request.json();
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }
    const body = raw as Record<string, unknown>;
    const agentId = body["agentId"] as string | undefined;
    const response = body["response"] as string | undefined;

    if (agentId === undefined || response === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, response" },
        { status: 400 }
      );
    }

    const { respondToHumanReview } = await import("@/modules/collaboration-runtime/facade");
    const result = await respondToHumanReview(params.id, agentId, response);

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deprecated: "This endpoint is deprecated. Use POST /messages { to: 'supervisor', message } instead.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to respond to human review" },
      { status: 500 }
    );
  }
}
