"use strict";
/**
 * Facade — 公共 API（组装层）
 *
 * Story 9.38 迁移后，API Routes 改为直接 import from '../../../modules/collaboration-runtime/facade'
 *
 * createSession / listSessions 等函数与旧 lib/collaboration-runtime-service 接口兼容。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProjectTopology = exports.respondToHumanReview = exports.sendMessageToSupervisor = exports.abortSession = exports.executeSession = exports.clientDisconnected = exports.unsubscribeFromEvents = exports.subscribeToEvents = exports.getEvents = exports.getBlackboardState = exports.getSession = exports.listSessions = void 0;
exports.createSession = createSession;
const event_bus_1 = require("./event-bus");
const session_store_1 = require("./session-store");
var session_store_2 = require("./session-store");
Object.defineProperty(exports, "listSessions", { enumerable: true, get: function () { return session_store_2.listSessions; } });
Object.defineProperty(exports, "getSession", { enumerable: true, get: function () { return session_store_2.getSession; } });
Object.defineProperty(exports, "getBlackboardState", { enumerable: true, get: function () { return session_store_2.getBlackboardState; } });
Object.defineProperty(exports, "getEvents", { enumerable: true, get: function () { return session_store_2.getEvents; } });
var event_bus_2 = require("./event-bus");
Object.defineProperty(exports, "subscribeToEvents", { enumerable: true, get: function () { return event_bus_2.subscribeToEvents; } });
Object.defineProperty(exports, "unsubscribeFromEvents", { enumerable: true, get: function () { return event_bus_2.unsubscribeFromEvents; } });
Object.defineProperty(exports, "clientDisconnected", { enumerable: true, get: function () { return event_bus_2.clientDisconnected; } });
// ============================================================================
// Re-export — dag-runner 公共 API
// ============================================================================
var dag_runner_1 = require("./dag-runner");
Object.defineProperty(exports, "executeSession", { enumerable: true, get: function () { return dag_runner_1.executeSession; } });
Object.defineProperty(exports, "abortSession", { enumerable: true, get: function () { return dag_runner_1.abortSession; } });
// ============================================================================
// Re-export — hitl-dispatcher 公共 API
// ============================================================================
var hitl_dispatcher_1 = require("./hitl-dispatcher");
Object.defineProperty(exports, "sendMessageToSupervisor", { enumerable: true, get: function () { return hitl_dispatcher_1.sendMessageToSupervisor; } });
Object.defineProperty(exports, "respondToHumanReview", { enumerable: true, get: function () { return hitl_dispatcher_1.respondToHumanReview; } });
// ============================================================================
// Re-export — topology 工具（从 engine 层 re-export）
// ============================================================================
var supervisor_dag_1 = require("../../../modules/collaboration-runtime/engine/supervisor-dag");
Object.defineProperty(exports, "loadProjectTopology", { enumerable: true, get: function () { return supervisor_dag_1.loadProjectTopology; } });
async function createSession(input) {
    // AG.2: agentDefinitionParser 通过动态 import 从 lib/integrations 获取，
    // 避免在模块顶层 import @/lib/**（违反模块边界规约）。
    const { parseAgentDefinition, parseToolDefinition } = await Promise.resolve().then(() => __importStar(require("../../../lib/integrations/pi-agent/persistent-agent")));
    return (0, session_store_1.createSession)(input, event_bus_1.eventEmitter, { parseAgentDefinition, parseToolDefinition });
}
