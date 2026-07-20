"use strict";
/**
 * OS.3: Agent Object Types - Agent 对象定义 (Story OS.3)
 *
 * Types for managed Agent objects that appear in Desktop/Dock
 *
 * NOTE: Core types (AgentType, AgentStatus, AgentObject, etc.) are defined in agent.ts
 * This file only contains hook return types and utility types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStatus = exports.AgentType = void 0;
const agent_1 = require("./agent");
Object.defineProperty(exports, "AgentType", { enumerable: true, get: function () { return agent_1.AgentType; } });
Object.defineProperty(exports, "AgentStatus", { enumerable: true, get: function () { return agent_1.AgentStatus; } });
