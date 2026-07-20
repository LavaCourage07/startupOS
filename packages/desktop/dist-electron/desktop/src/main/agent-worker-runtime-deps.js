"use strict";
/**
 * Compile anchor for packaged multi-agent worker runtime dependencies.
 *
 * The agent worker loads these modules via dynamic absolute imports at runtime,
 * so TypeScript/electron-builder cannot discover them from the normal static
 * desktop entry graph. Keeping this file in the desktop tsconfig include set
 * forces the required core modules to be emitted into dist-electron/core/src.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("../../../core/src/lib/integrations/pi-agent/cognitive/knowledge-provider");
require("../../../core/src/lib/integrations/pi-agent/cognitive/manager");
require("../../../core/src/lib/integrations/pi-agent/cognitive/pattern/index");
require("../../../core/src/lib/integrations/pi-agent/cognitive/practice-logger");
require("../../../core/src/lib/integrations/pi-agent/cognitive/sleep-compute");
require("../../../core/src/lib/integrations/pi-agent/core/agent");
require("../../../core/src/lib/integrations/pi-agent/persistent-agent");
require("../../../core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt");
require("../../../core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context");
require("../../../core/src/lib/integrations/pi-agent/project-agent/project-context");
require("../../../core/src/lib/integrations/pi-agent/project-agent/project-prompt");
require("../../../core/src/lib/integrations/pi-agent/server-config");
require("../../../core/src/lib/integrations/pi-agent/tools/index");
require("../../../core/src/lib/integrations/pi-agent/tools/context");
require("../../../core/src/modules/collaboration-runtime/engine/agent-context-writer");
require("../../../core/src/modules/collaboration-runtime/session/blackboard");
require("../../../core/src/modules/memory-core/index");
require("../../../core/src/modules/memory-core/session/memory-provider");
require("../../../core/src/modules/memory-core/tools/archival-memory-tools");
require("../../../core/src/modules/memory-core/tools/core-memory-tools");
