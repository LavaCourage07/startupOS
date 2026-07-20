# OriginOS CE

[中文](./README_CN.md)

OriginOS CE is an AI Native work system for individuals and small teams, and a personal business operating system exploring the next generation of operating systems. It is not an OS in the traditional sense — it is an Agent workbench running on Web / Electron desktop shell. Users define problems and organize workflows through projects, role agents, skills, files, notifications, and scheduled tasks, enabling the system to understand business context and generate applications, processes, knowledge, and collaboration structures in an AI Native way.

## Vision

OriginOS CE aims to build a working prototype for the next generation of operating systems. Future applications should not be determined solely by preset menus and fixed software forms — they should start from problems defined by users. The system understands context, breaks down tasks, organizes capabilities, and produces corresponding workspaces, application interfaces, automation flows, and collaborative agents in an AI Native manner.

Its core philosophy is making AI adapt to human thinking, rather than forcing humans to adapt to AI toolchains. The system captures users' implicit judgment, business context, and work preferences through dialogue, projects, skills, and long-term memory, transforming scattered embodied experience into referable, executable, and evolvable symbolic structures.

Regarding the relationship between humans and AI, OriginOS CE does not design AI as a one-shot Q&A tool, but as an operable system capability for long-term collaboration: humans raise questions, set goals, exercise judgment and taste; the system handles execution, organizes knowledge, discovers connections, generates tools, and continuously calibrates its behavior based on feedback.

## Core Capabilities

- **Homepage Workbench**: Organizes projects, roles, skills, files, notifications, and scheduled tasks in a unified desktop, letting users start from "defining problems."
- **Agent System**: Supports generic Agent, RoleAgent, Project Agent, streaming sessions, tool calling, working directory binding, runtime LLM config, and session isolation — enabling AI to participate in work as long-term roles.
- **Skill System**: Supports bundled / project / user multi-source skill loading, skill marketplace, skill window sessions, file uploads, and controlled artifact output — turning reusable workflows into callable, composable, and regenerable capabilities.
- **Project System**: Supports project initialization, project agents, project file management, business interviews, business-model artifacts, and solution templates — enabling AI to understand problems within specific business contexts.
- **Cognitive Persistence**: Maintains Agent/Project-level long-term context around `Memory.md`, `Knowledge.md`, `Patterns.md`, practice logs, and frozen snapshots — enabling experience accumulation and evolution across sessions.
- **AI Native Production**: Gradually organizes dialogue, knowledge, skills, agents, and interfaces into new work application forms around user-defined problems, rather than merely invoking existing software features.
- **System Capabilities**: File read/write, document parsing, system notifications, background scheduling, cross-window events, and auto-update infrastructure.
- **Multi-Agent Collaboration Runtime**: Starts supervisor / worker based on solution manifests, supporting blackboard, event streaming, human review, metrics, and production-grade logging.
- **Desktop Packaging**: Supports macOS arm64 / x64 DMG, Windows x64 NSIS installer and zip, with pre-packaging validation of worker runtime dependencies and root build artifacts.

## Tech Stack

- Next.js 14 App Router
- React 18 + TypeScript 5
- Tailwind CSS + shadcn/Radix base components
- Zustand state management
- Electron desktop runtime
- Local filesystem JSON storage
- Vitest testing
- pnpm workspace

## Repository Structure

```text
originos/
├── packages/
│   ├── web/             # Next.js Web UI
│   ├── desktop/         # Electron main/preload/packaging config
│   ├── core/            # Core business, Pi Agent, collaboration runtime, types
│   ├── service/         # Service layer package placeholder/aggregation
│   └── agent/           # @mariozechner/agent workspace compatibility
├── data/                # Local runtime data
├── docs/                # Architecture, Story, changelog, and design docs
├── templates/           # Template resources (skills, project-interview, etc.)
├── resources/           # Desktop resources
├── release/             # Local packaging output
├── AGENTS.md            # Architecture rules, mandatory during development
└── README.md
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- macOS desktop packaging requires native Electron / electron-builder dependencies

Install dependencies:

```bash
pnpm install
```

## LLM Configuration

LLM configuration follows the user's selection in the application settings page. Both desktop and Web runtimes read the current user configuration, including provider, base URL, model ID, credentials, max output tokens, and field mappings.

Supported providers include Anthropic, OpenAI-compatible, Google Gemini, and Azure OpenAI. After configuration updates, new Agent/Skill sessions use the latest settings; multi-agent collaboration child processes also inherit the parent's runtime model config.

## Development

Start Web development server:

```bash
pnpm dev
```

Start Electron desktop development mode:

```bash
pnpm desktop:dev
```

Common commands:

```bash
pnpm build                 # Build Web application
pnpm desktop:build         # Build Web + Desktop, validate worker runtime dependencies
pnpm desktop:build:app     # Package desktop application
pnpm lint                  # Run ESLint + dependency validation
pnpm test                  # Run Vitest
```

## Architecture Rules

See [AGENTS.md](./AGENTS.md) for mandatory architecture constraints, technology stack restrictions, directory structure rules, module dependency rules, core architecture constraints, performance targets, and data storage specifications.

## Quick Reference

| Topic | Key File |
|-------|----------|
| Architecture constraints | `AGENTS.md` |
| Application layer (Next.js) | `packages/web/src/app/` |
| Business logic | `packages/core/src/lib/features/` |
| Integrations (Pi Agent) | `packages/core/src/lib/integrations/pi-agent/` |
| Components | `packages/core/src/components/` |
| Global types | `packages/core/src/types/` |
| Desktop entry | `packages/desktop/src/main/` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development process, commit conventions, PR requirements, and branch strategy.

## License

See [LICENSE](./LICENSE).

## Directory Quick Reference

- `packages/web/src/config/homeApps.ts` — Homepage app entry configuration
- `packages/web/src/services/AppWindowManager.ts` — CSS-based window manager
- `packages/core/src/lib/integrations/pi-agent/` — Pi Agent integration
- `packages/core/src/components/` — Shared UI components
- `packages/core/src/types/` — Global type definitions
- `packages/desktop/src/main/` — Electron main process
- `data/skills/` — Homepage skill entry artifacts
- `data/agents/` — Built-in/user Agent runtime files and cognitive data
- `data/sessions/` — Global Agent sessions

## Testing and Verification

```bash
# Unit tests
pnpm test

# Coverage
pnpm test --coverage

# Specific module tests
pnpm test -- --testPathPattern=features/ontology
```
