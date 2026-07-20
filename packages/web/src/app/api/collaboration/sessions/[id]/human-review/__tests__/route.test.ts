import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Story 9.34 — human-review 路由 deprecated 行为
// ============================================================================

const mockRespondToHumanReview = vi.fn();

vi.mock("@/modules/collaboration-runtime/facade", () => ({
  respondToHumanReview: mockRespondToHumanReview,
}));

const { POST } = await import("../route");

describe("POST /api/collaboration/sessions/[id]/human-review — Story 9.34", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRespondToHumanReview.mockResolvedValue({ success: true });
  });

  it("accepts valid agentId + response and returns deprecated notice", async () => {
    const request = new NextRequest(
      "http://localhost/api/collaboration/sessions/cs-test/human-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "project-config", response: "项目名称是 OriginOS" }),
      }
    );

    const response = await POST(request, { params: { id: "cs-test" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // deprecated 字段告知调用方此路由已废弃
    expect(data.deprecated).toContain("supervisor");
  });

  it("delegates to respondToHumanReview with sessionId and response", async () => {
    const request = new NextRequest(
      "http://localhost/api/collaboration/sessions/cs-test/human-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "naming-reviewer", response: "使用驼峰命名" }),
      }
    );

    await POST(request, { params: { id: "cs-test" } });

    expect(mockRespondToHumanReview).toHaveBeenCalledWith(
      "cs-test",
      "naming-reviewer",
      "使用驼峰命名"
    );
  });

  it("returns 400 when agentId is missing", async () => {
    const request = new NextRequest(
      "http://localhost/api/collaboration/sessions/cs-test/human-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: "some answer" }),
      }
    );

    const response = await POST(request, { params: { id: "cs-test" } });
    expect(response.status).toBe(400);
    expect(mockRespondToHumanReview).not.toHaveBeenCalled();
  });

  it("returns 400 when response is missing", async () => {
    const request = new NextRequest(
      "http://localhost/api/collaboration/sessions/cs-test/human-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "project-config" }),
      }
    );

    const response = await POST(request, { params: { id: "cs-test" } });
    expect(response.status).toBe(400);
  });

  it("forwards service error as 400", async () => {
    mockRespondToHumanReview.mockResolvedValue({
      success: false,
      error: "Supervisor process not found",
    });

    const request = new NextRequest(
      "http://localhost/api/collaboration/sessions/cs-test/human-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "project-config", response: "ok" }),
      }
    );

    const response = await POST(request, { params: { id: "cs-test" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Supervisor process not found");
  });
});
