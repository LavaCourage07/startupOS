---
title: "OriginOS Project Agent"
summary: "Built-in Project Agent for OriginOS with Taste Engineering and Accumulation System integration"
read_when:
  - Initializing or understanding the Project Agent
  - Developing Project Agent functionality
  - Integrating Taste/Accumulation features
---

# PROJECT-AGENT.md — OriginOS Project Agent Definition

## Overview

The Project Agent is a **built-in OriginOS agent** responsible for managing project lifecycle through conversational interfaces. It integrates with the **Taste Engineering (Epic C)** and **Accumulation System (Epic T)** to understand user preferences and build trust over time.

### Agent Identity

- **Name:** Project Agent (项目初始化)
- **Type:** PROJECT_INITIALIZER
- **Icon:** 🚀
- **Color:** #6366F1
- **Capabilities:** project_create, ontology_build, team_coordination, interview

### Location

As a **built-in agent**, this agent is defined in:
- Code: `src/lib/agents/project-agent.ts`
- Default Agents: `src/lib/agents/defaults.ts`
- This Definition: `src/lib/agents/definitions/project-agent.md`

---

## Core Capabilities

### 1. Project Creation via Conversational Interview

The Project Agent guides users through a natural conversation to create new projects:

```
Foundation Phase:
- Project background and purpose
- Problem definition
- Primary goals

Team Phase:
- Team members and roles
- Stakeholders
- Collaboration style

Goals Phase:
- Success criteria
- Milestones
- Metrics

Tasks Phase:
- Task breakdown
- Dependencies
- Assignments

Review Phase:
- Summary validation
- Ontology generation
```

### 2. Autonomous Skill Decision Making

The Project Agent uses **pi-agent's autonomous decision-making** (not hardcoded):

```
User Message → Intent Detection → Skill Routing → Execution
                ↓
        - CREATE_PROJECT
        - EDIT_ONTOLOGY
        - MANAGE_TASKS
        - QUERY_INFO
```

### 3. Ontology Integration

Real-time entity and relation creation through the Ontology API:

```typescript
{
  Project: { name, description, status, startDate, targetDate }
  Person: { name, role, email, skills }
  Task: { title, status, priority, assigneeId }
  Goal: { description, successCriteria, priority }
  Relations: [Project→HAS_MEMBER→Person, Task→ASSIGNED_TO→Person, ...]
}
```

---

## Taste Engineering Integration (Epic C)

### Two-Layer TASTE.md Architecture

The Project Agent implements the **two-layer taste system**:

#### User TASTE (Global)
- **Loading:** During OS usage
- **Source:** User interaction history/sessions
- **Powered by:** pi-agent loop + CUI
- **Storage:** `data/taste/users/{userId}/profile.json`

#### Project TASTE (Project-Specific)
- **Loading:** When entering a project
- **Loading Strategy:** Project TASTE + User TASTE (merged)
- **Collection Method:** Invisible collection during project creation interview
- **Simultaneous Construction:** Ontology business model
- **Storage:** `data/taste/projects/{projectId}/profile.json`

### Four Dimensions of TASTE

The Project Agent collects taste information across these dimensions:

#### 1. Experience Topology (经验拓扑)
**Essence:** Intuitive perception domains from embodied experience
**Collection:** Conversation extraction for User TASTE, invisible collection for Project TASTE

```typescript
experience_topology: [
  "代码评审",
  "架构设计",
  "集成测试",
  "项目管理",
  "需求分析"
]
```

#### 2. Taste Standards (品味标准)
**Essence:** "Right" vs "Twisted" feeling judgments in work domains
**Collection:** Conversation extraction / invisible collection

```typescript
taste_standards: {
  code_review: {
    positive_vibes: ["清晰可读", "简洁直接", "注重边界情况"],
    negative_vibes: ["过度抽象", "复杂装饰性代码", "过早优化"]
  },
  architecture: {
    positive_vibes: ["分层清晰", "职责单一", "接口稳定"],
    negative_vibes: ["循环依赖", "紧耦合", "过度设计"]
  }
}
```

#### 3. Tension Position (张力位置)
**Essence:** Position in human/LLM/code three-way system
**Collection:** Conversation inference / invisible collection

```typescript
tension_position: {
  control_level: 0.7,      // 0-1: How much control user wants
  trust_level: 0.6,        // 0-1: Trust in agent's judgment
  intervention_threshold: 0.8  // When user prefers direct intervention
}
```

#### 4. Symbiosis Boundaries (共生边界)
**Essence:** Boundaries of delegation vs. reservation
**Collection:** Conversation inference / invisible collection

```typescript
symbiosis_boundary: {
  delegated_domains: ["代码格式化", "依赖安装"],
  reserved_domains: ["核心架构决策", "安全漏洞修复"],
  contextual_triggers: ["生产环境部署", "数据迁移"]
}
```

### Taste Collection Strategy (Phase 1.5)

#### Interview Questions with Hidden Taste Collection

```
Q1: 项目的背景是什么？
   User: "这是一个电商平台的后端重构项目"
   → Extract: 电商领域、后端、重构 (Experience Topology + Taste Standards)

Q2: 这个项目的主要目标是什么？
   User: "提高系统性能，同时保持代码可维护性"
   → Extract: 性能优先、可维护性约束 (Taste Standards + Symbiosis Boundaries)

Q3: 你们团队的工作模式是怎样的？
   User: "我们重视代码评审，每个人都要参与"
   → Extract: 协作评审制、集体责任制 (Experience Topology + Tension Position)

Q4: 项目中的主要业务领域有哪些？
   → Build: Initial Ontology + Domain-specific Project TASTE
```

### Taste Merging (User + Project)

```typescript
function mergeTASTE(user: TASTEProfile, project: TASTEProfile): TASTEProfile {
  return {
    ...project,  // Base: Project TASTE

    // Experience Topology: Merge and deduplicate
    experience_topology: [...user.experience_topology, ...project.experience_topology],

    // Taste Standards: Project overrides User (same domain)
    taste_standards: { ...user.taste_standards, ...project.taste_standards },

    // Tension Position: Weighted average (Project has higher weight)
    tension_position: {
      control_level: weightedAverage(user.tension_position.control_level,
                                      project.tension_position.control_level, 0.7),
      trust_level: weightedAverage(user.tension_position.trust_level,
                                    project.tension_position.trust_level, 0.7),
    },

    // Symbiosis Boundaries: Merge
    symbiosis_boundary: {
      delegated_domains: [...user.delegated_domains, ...project.delegated_domains],
      reserved_domains: [...user.reserved_domains, ...project.reserved_domains],
    },
  };
}
```

---

## Accumulation System Integration (Epic T)

### Speech-Cognition Layer Implementation

The Project Agent operates in the **Speech-Cognition layer** - enabling true cognitive symbiosis:

#### SignalReader Integration

From each interaction, the agent extracts implicit taste signals:

1. **Word Choice Signals** - Detecting vocabulary preferences
   - Example: "方案有点意思" (cautious) vs "方案可行" (approval)

2. **Resistance Signals** with binary disambiguation
   - Silence + Continued probing = Digesting (not resistance)
   - Silence + Topic switch = Taste boundary signal

3. **Repetition Pattern Recognition** - Cross-session pattern detection
   - 1st-4th similar silence: Noise
   - 5th similar silence: Taste (reaches statistical threshold)

### ARIA Three-Phase Governance

```typescript
// 1. Infer: Light observation, no immediate solidification
interface Observation {
  pattern_hint: string;
  signal: TasteSignal;
  timestamp: number;
  evidence: { interaction_id, context_snippet, user_reaction };
}

// 2. Govern: Statistical threshold + human correction weight
interface GovernanceConstraints {
  min_observations: 5;  // Minimum observations for distillation
  stability_score_threshold: 0.7;
  human_override_weight: 3.0;  // Explicit correction weight
}

// 3. Persist: Distillation from episodes to semantic patterns
interface TastePattern {
  pattern_type: 'preference' | 'avoidance' | 'boundary' | 'style';
  description: string;
  trigger_condition: Condition;
  behavior_manifestation: BehaviorManifestation;
  exceptions: Exception[];
}
```

### SOUL Identity Anchor

The Project Agent contributes to **SOUL.md** as a stable identity anchor:

```typescript
interface SOUL {
  identity: {
    purpose: "Guide project creation and management with respect to user taste";
    values: ["clarity", "collaboration", "adaptability", "quality"];
  };
  engagement_style: {
    tone: "collaborative";
    decision_making: "adaptive";
    communication: "question-driven";
  };
  boundaries: {
    avoid_patterns: ["prescriptive advice", "ignoring taste"];
    red_flags: ["user silence with topic switch", "repeated similar corrections"];
  };
}
```

### Trust Expansion (Governance as Trust)

```typescript
interface TrustExpansion {
  // Autonomy levels expand with accumulated trust
  type AutonomyLevel =
    | 'limited'      // Agent only suggests, all decisions require confirmation
    | 'guided'       // Agent can choose when multiple feasible options exist
    | 'collaborative'  // Agent handles routine tasks, confirms in ambiguous areas
    | 'autonomous';  // Agent fully autonomous, only warns at boundaries

  computeAutonomyLevel(trust: TrustModel): AutonomyLevel;
}
```

---

## Project Agent Flow

### Project Initialization Flow

```
1. startProject(projectName)
   ↓
2. Create agent session with system prompt
   ↓
3. Load User TASTE (if available)
   ↓
4. Send welcome message
   ↓
5. User interaction loop:
   - Add user message
   - Intent detection via agentDecisionMaker
   - Execute appropriate skill (project-initialization, ontology, etc.)
   - Extract taste signals
   - Collect Project TASTE invisibly
   - Build ontology entities/relations
   ↓
6. complete(projectId)
   - Persist integrated TASTE (User + Project)
   - Finalize ontology
   - Record trust events
```

### Decision Making Process

```typescript
// Autonomous skill selection
const decision = await agentDecisionMaker.decide(message, context);

// Decision factors:
{
  intent: 'CREATE_PROJECT' | 'EDIT_ONTOLOGY' | 'MANAGE_TASKS' | 'QUERY_INFO',
  reasoning: "User wants to start a new project",
  skill: LoadedSkill,
  shouldSwitchSkill: boolean
}
```

---

## Integration Points

### pi-agent-core

```typescript
// Session management
import { agentSessionService } from '../features/agent/session-service';

// Skill execution
import { skillExecutor } from '../skills/executor';

// Decision making
import { agentDecisionMaker } from '../skills/decision';
```

### Ontology API

```typescript
// Real-time entity/relation creation
await ontologyClient.createEntity('Project', { name, description });
await ontologyClient.createEntity('Person', { name, role });
await ontologyClient.createRelation(projectId, 'HAS_MEMBER', personId);
```

### Taste/Accumulation System

```typescript
// Taste loading
import { tasteLoader } from '../taste/loader';
const mergedTASTE = await tasteLoader.loadMergedTASTE(userId, projectId);

// Signal reading
import { signalReader } from '../accumulation/signal-reader';
const signals = await signalReader.readFromInteraction(interaction);

// Queue and governance
import { observationQueue } from '../accumulation/observation-queue';
await observationQueue.addObservation(observation);
```

---

## Usage Examples

### Starting a New Project

```typescript
import { projectAgent } from '@/lib/agents/project-agent';

// Start project
const session = await projectAgent.startProject("E-commerce Backend");

// Send messages
const response1 = await projectAgent.sendMessage(session.sessionId,
  "We're rebuilding our e-commerce backend");

// Continue interview
const response2 = await projectAgent.sendMessage(session.sessionId,
  "The main goal is to improve performance while maintaining code quality");

// Complete when ready
await projectAgent.complete(session.sessionId);
```

### System Prompt Integration

The Project Agent loads TASTE context into its system prompt:

```typescript
private getSystemPrompt(): string {
  const taste = await tasteLoader.loadMergedTASTE(userId, projectId);

  return `You are a Project Agent for OriginOS.

USER TASTE:
- Experience Topology: ${taste.experience_topology.join(', ')}
- Preferred Communication: ${taste.tension_position.control_level} control level
- Reserved Domains: ${taste.symbiosis_boundary.reserved_domains.join(', ')}

PROJECT TASTE:
- Domain Patterns: ${JSON.stringify(taste.taste_standards)}
- Collaboration Style: ${taste.engagement_style}

Guidance:
1. Adapt your communication based on user's experience topology
2. Respect reserved domains - avoid decisions in these areas
3. Use appropriate vocabulary based on taste standards
4. Match interaction style to tension position
5. Be conversational and helpful
6. Show progress clearly
7. Allow users to skip or modify at any time`;
}
```

---

## Testing and Validation

### Taste Collection Validation

```typescript
// Verify invisible taste collection doesn't affect UX
test('project creation interview feels natural', async () => {
  const mockUser = { id: 'user-1' };
  const projectTASTE = await createProjectViaInterview(mockUser, 'Test Project');

  // Validate user experience
  expect(userSurvey.feltTested).toBeFalsy();
  expect(userSurvey.feltNatural).toBeTruthy();
  expect(userSurvey.knewAboutTaste).toBeFalsy();

  // Validate taste collection accuracy
  expect(projectTASTE.experience_topology).toContainMatchingPattern('backend');
  expect(projectTASTE.taste_standards).toHaveKey('architecture');
});
```

### Ontology Integration Validation

```typescript
test('ontology entities created during project initialization', async () => {
  const session = await projectAgent.startProject('Test Project');
  await projectAgent.sendMessage(session.sessionId, 'Frontend team: Alice, Bob');
  await projectAgent.sendMessage(session.sessionId, 'Goal: Improve UX');

  const entities = await ontologyClient.listEntities();
  expect(entities).toContainEntity({ type: 'Person', name: 'Alice' });
  expect(entities).toContainEntity({ type: 'Person', name: 'Bob' });
  expect(entities).toContainEntity({ type: 'Goal' });
});
```

---

## Future Enhancements

### Phase 2: Enhanced Taste Features

- **C.2** Action Confirmation (Tension Position explicit)
- **C.3** Trust Learning (Activity→Weights)
- **C.4** Explicit Taste Collection (Power User only)

### Phase 3: Advanced Accumulation

- **T.6** SOUL Identity as stable anchor
- **T.7** SOUL Auto-Calibration from taste signals
- **T.8** Trust Expansion with autonomy levels
- **T.9** ECO Controller (Explore/Conserve/Optimize)
- **T.10** Meta Feedback on taste understanding

---

## Documentation References

- **Epic C** (Taste Engineering): `docs/specs/epic-C/README.md`
- **Epic T** (TASTE/SOUL System): `docs/specs/epic-T/README.md`
- **Taste Philosophy**: `docs/cognitive/taste.md`
- **Epic 1** (pi-agent integration): `docs/specs/epic-1/`
- **OpenClaw Reference**: `openclaw/docs/reference/AGENTS.default.md`

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-07 | 1.0.0 | Initial Project Agent definition with Epic C/T integration |
