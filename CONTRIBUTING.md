# Contributing to OriginOS

Thank you for your interest in contributing to OriginOS! This document provides guidelines and information for contributors.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem
- **Describe the exact steps which reproduce the problem** in as many details as possible
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** after following the steps and point out what exactly is the problem with that behavior
- **Explain which behavior you expected to see** instead and why
- **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why
- **Include screenshots and animated GIFs** which help you demonstrate the steps or point out the part of OriginOS which the suggestion is related to

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the project's coding standards
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js 22.12+ (required by Electron 42)
- pnpm 9.x+ (see [CLAUDE.md](CLAUDE.md) for monorepo conventions)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/startupOS.git
cd startupOS

# Install dependencies
pnpm install

# Start development server (Web)
pnpm dev

# Start development server (Desktop)
pnpm desktop:dev
```

### Project Structure

Please refer to [CLAUDE.md](CLAUDE.md) for the complete architecture specification and directory structure.

Key directories:
- `packages/web/` - Next.js Web UI
- `packages/desktop/` - Electron main/preload
- `packages/core/` - Shared business logic, Pi Agent, collaboration runtime
- `docs/` - Architecture docs, design specs, change logs

## Coding Standards

### TypeScript

- Use strict mode (configured in `tsconfig.base.json`)
- Prefer explicit types over `any`
- Use interfaces for object shapes, types for unions/intersections
- Export types from `packages/core/src/types/`

### React

- Use functional components with hooks
- Prefer composition over inheritance
- Use Zustand for state management (see CLAUDE.md for details)

### Styling

- Use Tailwind CSS utility classes
- Follow the design system in `tailwind.config.ts`
- Avoid inline styles and CSS modules

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(web): add skill dialog component`
- `fix(core): resolve zod dependency issue`
- `docs: update CONTRIBUTING.md`

## Architecture Constraints

**Important:** All contributions must follow the architecture rules defined in [CLAUDE.md](CLAUDE.md), including:

- Monorepo package dependencies (unidirectional: web/desktop → core)
- Layer-based module dependencies (app → components → services → features → storage)
- No cross-feature internal imports (use public API via index.ts)
- No class components, Redux, MobX, or databases (MVP phase)

## Testing

- Unit tests: Vitest (`pnpm test`)
- Type checking: `pnpm type-check`
- Linting: `pnpm lint`
- E2E tests: See `scripts/test-*.mjs` and `scripts/test-*.sh`

## Questions?

Feel free to open an issue with the `question` label, or reach out to the maintainers.

Thank you for contributing to OriginOS! 🚀
