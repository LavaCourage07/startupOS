import { NextResponse } from "next/server";

/**
 * GET /api/collaboration/sessions/[id]/events
 *
 * Returns SSE stream. On connect, replays all historical events first,
 * then subscribes to real-time events.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { subscribeToEvents, clientDisconnected, getEvents } = await import("@/modules/collaboration-runtime/facade");

    let heartbeat: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    let client: SseClientLike;

    interface SseClientLike {
      send: (_event: string, data: string) => void;
      close: () => void;
    }

    const stream = new ReadableStream({
      async start(controller) {
        client = {
          send: (_event: string, data: string) => {
            controller.enqueue(`data: ${data}\n\n`);
          },
          close: () => {
            controller.close();
          },
        };

        // Replay historical events before subscribing to live stream
        try {
          const history = await getEvents(params.id);
          for (const ev of history) {
            if (ev.type !== "MESSAGE_SENT") {
              controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
            }
          }
        } catch {
          // If history load fails, proceed to live stream anyway
        }

        subscribeToEvents(params.id, client);

        heartbeat = setInterval(() => {
          controller.enqueue(`: heartbeat\n\n`);
        }, 30_000);

        timeout = setTimeout(() => {
          clearInterval(heartbeat);
          clientDisconnected(params.id, client);
          controller.close();
        }, 600_000);
      },
      cancel() {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        clientDisconnected(params.id, client!);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to stream events" },
      { status: 500 }
    );
  }
}
