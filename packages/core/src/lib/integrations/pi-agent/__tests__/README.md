# Pi-Agent Integration Unit Tests

Unit tests for verifying the pi-agent-core integration with OriginOS.

## Overview

This test suite validates the correct integration of [`pi-agent-core`](https://github.com/mariozechner/pi-mono/tree/main/packages/agent) with OriginOS. All tests mock external `pi-mono` dependencies to ensure tests can run independently.

## Test Files

| File | Description | Test Count |
|------|-------------|------------|
| `core/__tests__/agent.test.ts` | OriginOSAgent class tests | ~70 |
| `tools/__tests__/registry.test.ts` | ToolRegistry class tests | ~65 |
| `system/__tests__/config.test.ts` | Configuration management tests | ~50 |
| `store.test.ts` | Zustand store tests | ~90 |
| `__tests__/mocks/pi-mono-mocks.ts` | Mock utilities | - |

**Total:** ~275 test cases

## Test Coverage

- ✅ Agent creation and initialization
- ✅ Session lifecycle (create, start, stop, destroy)
- ✅ Event subscription mechanism
- ✅ Message sending and receiving
- ✅ Tool registration and invocation
- ✅ Configuration management validation

## Running Tests

```bash
# Run all tests in this directory
pnpm test src/lib/integrations/pi-agent

# Run specific test file
pnpm test src/lib/integrations/pi-agent/core/__tests__/agent.test.ts

# Run with coverage report
pnpm test:coverage

# Watch mode (re-runs on file changes)
pnpm test:watch

# Run only failed tests
pnpm test --reporter=verbose
```

## Test Structure

### Agent Tests (`core/__tests__/agent.test.ts`)

Tests the `OriginOSAgent` wrapper class:

- **Agent Creation & Initialization**
  - Valid config creation
  - State initialization
  - SessionId handling
  - Project context storage

- **Session Lifecycle**
  - Send messages (string, object, array)
  - Continue previous session
  - Abort operation
  - Wait for idle
  - Get session state
  - Destroy agent

- **Event Subscription**
  - Subscribe/unsubscribe
  - Multiple subscribers
  - Event emission
  - Event handling (agent_start, agent_end, turn_start, turn_end)

- **Message Management**
  - Send string messages
  - Send message objects
  - Send message arrays
  - Include images
  - Clear messages
  - Replace messages
  - Append messages

- **Tool Operations**
  - Set tools
  - Register single tool
  - Unregister tool
  - Track active tools

- **Configuration**
  - Set system prompt
  - Set model

### Registry Tests (`tools/__tests__/registry.test.ts`)

Tests the `ToolRegistry` class:

- **Tool Registration**
  - Register single tool
  - Register batch tools
  - Duplicate handling

- **Tool Retrieval**
  - Get by name
  - Check existence
  - Get all tools
  - Get enabled tools
  - Get by category

- **Tool Enable/Disable**
  - Enable tool
  - Disable tool
  - Update enabled list

- **Tool Conversion**
  - Convert to AgentTool format
  - Filter disabled tools
  - Preserve properties

- **Global Registry**
  - Singleton instance
  - Global register function
  - Get agent tools

- **Tool Execution**
  - Execute callbacks
  - Tool call ID handling
  - Params passing
  - Signal handling
  - Update callbacks

### Config Tests (`system/__tests__/config.test.ts`)

Tests configuration management:

- **DEFAULT_CONFIG**
  - Model settings
  - Project context defaults
  - Thinking level
  - Tools array

- **createOriginOSAgentConfig**
  - Session ID creation
  - System prompt building
  - Variable mapping
  - Override support
  - Project context creation

- **validateConfig**
  - Required fields
  - Empty value detection
  - Missing field detection
  - Multiple errors

- **ProjectContext**
  - Required: projectId
  - Optional: ontologyId, currentPath, projectName, userId

### Store Tests (`store.test.ts`)

Tests the Zustand store:

- **State Initialization**
  - Default state values
  - Required properties
  - Store singleton

- **Agent Lifecycle**
  - Initialize agent
  - State updates
  - Error handling
  - Destroy agent

- **Message Sending**
  - Send messages
  - Running state
  - Error handling

- **Agent Operations**
  - Abort
  - Retry/continue
  - Wait for idle

- **Tool State**
  - Active tools tracking
  - Tool start/end events

- **Context Management**
  - Update project context
  - Partial updates
  - Preserve existing data

- **Configuration**
  - System prompt
  - Thinking level

- **Event Handling**
  - Subscribe to events
  - Handle agent events
  - Update UI state

- **State Management**
  - Reset state
  - Consistency checks
  - React hooks integration

## Mock Utilities

The `__tests__/mocks/pi-mono-mocks.ts` file provides:

- `MockAgent` - Mock pi-agent-core Agent class
- `mockGetModel` - Mock model factory
- `mockCreateMessage` - Mock message creator

## Dependencies

All tests mock these external dependencies:

```typescript
import { Agent } from "@originos/pi-agent-adapter";
import { getModel } from "@originos/pi-agent-adapter/ai";
```

These are mocked to isolate unit tests from external API calls.

## Contributing

When adding new features to the pi-agent integration:

1. Add tests to the appropriate test file
2. Update this README with new test descriptions
3. Ensure mocks cover any new external dependencies
4. Run tests to verify no regressions

## Troubleshooting

### Tests fail with "Module not found"

Ensure all mocks are properly configured in `__tests__/mocks/`.

### Coverage is low

Add test cases for uncovered code paths identified in the coverage report.

### Tests are flaky

Check for async timing issues and add proper await/promise handling.
