"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectExecutionMode = selectExecutionMode;
function selectExecutionMode(topology) {
    const edges = topology.collaborations ?? [];
    const hasNotify = edges.some((e) => e.type === "notify");
    const hasBackEdge = edges.some((e) => e.from !== undefined && e.to !== undefined && e.from === e.to);
    return hasNotify || hasBackEdge ? "system" : "workflow";
}
