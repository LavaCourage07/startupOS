"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownGlobalSpawner = exports.getGlobalSpawner = exports.AgentSpawner = exports.AgentProcess = void 0;
var agent_spawner_1 = require("./agent-spawner");
Object.defineProperty(exports, "AgentProcess", { enumerable: true, get: function () { return agent_spawner_1.AgentProcess; } });
Object.defineProperty(exports, "AgentSpawner", { enumerable: true, get: function () { return agent_spawner_1.AgentSpawner; } });
Object.defineProperty(exports, "getGlobalSpawner", { enumerable: true, get: function () { return agent_spawner_1.getGlobalSpawner; } });
Object.defineProperty(exports, "shutdownGlobalSpawner", { enumerable: true, get: function () { return agent_spawner_1.shutdownGlobalSpawner; } });
