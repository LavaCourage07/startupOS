/**
 * mode-router.ts — Story 9.28F
 * 根据拓扑选择执行模式：workflow | system
 * v1.0 规则：拓扑中存在 notify/回边 → system，否则 workflow。
 */
export type ExecutionMode = "workflow" | "system";

export interface CollaborationEdge {
  from: string;
  to: string;
  type?: string; // trigger | notify | depend
}

export interface Topology {
  collaborations: CollaborationEdge[];
}

export function selectExecutionMode(topology: Topology): ExecutionMode {
  const edges = topology.collaborations ?? [];
  const hasNotify = edges.some((e) => e.type === "notify");
  const hasBackEdge = edges.some((e) => e.from !== undefined && e.to !== undefined && e.from === e.to);
  return hasNotify || hasBackEdge ? "system" : "workflow";
}
