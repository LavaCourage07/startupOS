<div align="center">

<img src="docs/assets/readme/originos-banner.png" alt="OriginOS CE" />

<p>
  <a href="https://github.com/NeuralNexusPro/startupOS/releases/latest"><img src="https://img.shields.io/github/v/release/NeuralNexusPro/startupOS?style=flat-square&label=release" alt="Latest release" /></a>
  <a href="https://github.com/NeuralNexusPro/startupOS/actions/workflows/desktop-release.yml"><img src="https://img.shields.io/github/actions/workflow/status/NeuralNexusPro/startupOS/desktop-release.yml?style=flat-square&label=desktop%20build" alt="Desktop build" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-2f81f7?style=flat-square" alt="AGPL-3.0" /></a>
  <a href="https://github.com/NeuralNexusPro/startupOS/stargazers"><img src="https://img.shields.io/github/stars/NeuralNexusPro/startupOS?style=flat-square" alt="GitHub stars" /></a>
</p>

**English** | [简体中文](./README_CN.md)

<video src="https://cdn.artseeu.cn/originos-product-philosophy.mp4" controls width="960">
  <a href="https://cdn.artseeu.cn/originos-product-philosophy.mp4">Watch the OriginOS product philosophy video</a>
</video>

[Open the product philosophy video](https://cdn.artseeu.cn/originos-product-philosophy.mp4)

</div>

## What is OriginOS CE?

OriginOS CE is an AI-native work system for individuals and small teams. Instead of starting from fixed software menus, it starts from the problem you want to solve and brings projects, agents, roles, skills, files, knowledge, notifications, and scheduled work into one desktop.

Use it to:

- turn a business problem into a project with its own context, files, and ontology;
- create reusable Agents and RoleAgents with persistent memory and working directories;
- run packaged skills as focused applications, with file input and controlled output;
- design a solution and coordinate multiple Agents for longer-running work;
- keep work artifacts and context on your own machine.

## Download and Install

Download the newest build from [GitHub Releases](https://github.com/NeuralNexusPro/startupOS/releases/latest).

| Platform            | Package     | Installation                                                                    |
| ------------------- | ----------- | ------------------------------------------------------------------------------- |
| Windows x64         | `.exe`      | Download the installer, run it, and launch **OriginOS CE** from the Start menu. |
| macOS Apple Silicon | `arm64.dmg` | Open the DMG and drag **OriginOS CE** into Applications.                        |
| macOS Intel         | `x64.dmg`   | Open the DMG and drag **OriginOS CE** into Applications.                        |

Release assets are signed and validated by the desktop release workflow. Update metadata and full packages are published together.

## First Run

1. Open **Settings** and configure a model provider, model ID, endpoint, and credential.
2. Return to the desktop and choose a starting point:
   - **Create Project** for work that needs business context, files, modeling, and a solution;
   - **Skills** for a focused, reusable workflow;
   - **Create Agent / Create Role** for a persistent assistant with its own identity and workspace.
3. Send a message, attach files when needed, and inspect generated artifacts from the workspace button.

Anthropic, OpenAI-compatible, Google Gemini, and Azure OpenAI configurations are supported. Credentials remain in the local application configuration.

## Product Tour

### Build a project from business context

OriginOS interviews the user, structures the business model, and keeps the conversation and model visible in the same workspace.

<p align="center">
  <img src="docs/assets/readme/originos-interview.png" width="48%" alt="Project interview" />
  <img src="docs/assets/readme/originos-ontology.jpg" width="48%" alt="Ontology workspace" />
</p>

### Turn repeatable work into skills and roles

Skills provide focused workflows. RoleAgents keep identity, memory, knowledge, tools, and working artifacts together across sessions.

<p align="center">
  <img src="docs/assets/readme/originos-skill.png" width="48%" alt="Skill window" />
  <img src="docs/assets/readme/originos-role.png" width="48%" alt="RoleAgent window" />
</p>

### Coordinate longer-running work

Solution design can be executed by a multi-agent runtime with visible tasks, progress, review points, and artifacts.

<p align="center">
  <img src="docs/assets/readme/originos-multi-agent.jpg" width="88%" alt="Multi-agent runtime" />
</p>

## Run from Source

Requirements: Node.js **22.19+**, pnpm **9+**, and Git.

```bash
git clone https://github.com/NeuralNexusPro/startupOS.git
cd startupOS
corepack enable
pnpm install
pnpm desktop:dev
```

Use `pnpm dev` to run only the Web interface. Local desktop packages can be created with `pnpm desktop:dist`.

## Data and Privacy

- Runtime data is stored locally under the application data directory.
- Projects, sessions, skills, Agents, knowledge, and generated files remain file-based.
- Model requests are sent only to the provider configured by the user.
- Before reporting a bug, remove API keys, credentials, and private document content from logs.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) and read [AGENTS.md](./AGENTS.md) before changing code.

- Bugs: open an [issue](https://github.com/NeuralNexusPro/startupOS/issues) with the OriginOS version, operating system, reproduction steps, expected result, actual result, and sanitized logs.
- Features: describe the user problem and expected workflow before proposing implementation details.
- Pull requests: branch from `dev`, keep changes scoped, add tests, and update documentation when behavior changes.
- Verification: run the relevant unit/integration tests plus `pnpm lint`; desktop changes should also pass the package verification scripts they affect.
- Architecture: shared business logic belongs in `packages/core`; Web and Electron remain adapters around core APIs.

For substantial changes, create or update the corresponding Epic/Story under `docs/specs/` and include its acceptance and regression cases.

## License

OriginOS CE is released under the [GNU Affero General Public License v3.0](./LICENSE).
