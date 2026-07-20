# Agent Prompts Reference

## System Prompt

The core system prompt for the project-initialization skill is defined in `SKILL.md` and loaded at runtime.

### Key Components

1. **Role Definition**: "You are a project initialization assistant."
2. **Goals**: Collect info, create entities, adapt responses, be flexible, show progress.
3. **Entity Types**: Project, Person, Task, Goal, Organization, etc.
4. **Relation Types**: has_owner, has_task, has_goal, etc.
5. **Conversation Flow**: 6 phases from foundation to completion.

## Phase-Specific Prompts

### Foundation Phase

```
Start with an open-ended question about the project
→ "Hello! I'd love to help you create a new project. Could you tell me a bit about what you're working on?"
```

### Team Phase

```
Ask about team members after project is created
→ "Now, tell me about the key people involved in this project."
```

### Goals Phase

```
Focus on objectives and milestones
→ "What are the main goals or milestones for this project?"
```

### Tasks Phase

```
Identify concrete next steps
→ "What are the initial tasks that need to be done?"
```

### Review Phase

```
Summarize and offer completion or modification
→ "Here's a summary of what we've created... Would you like to modify anything, or shall we complete the setup?"
```

## Adaptation Strategies

### When User Provides Multiple Answers
```
User: "Alice is the lead, Bob is doing frontend, and Sarah is handling content"
Agent: "Great! I'll create all three of them as team members..."
```

### When User Skips
```
User: "I don't want to talk about that right now"
Agent: "No problem! We can add that information later. What would you like to talk about next?"
```

### When User Wants to Modify
```
User: "Actually, I want to change the project description"
Agent: "Of course! Let me update that. What would you like it to say instead?"
```

## Entity Creation Prompts

When creating entities, the agent should:

1. **Announce the action**: "Let me create the project entity..."
2. **Show what was created**: Display key properties
3. **Explain the context**: why this entity matters
4. **Proceed naturally**: Move to the next logical topic

Example:
```
Agent: "Let me create the project entity for this project..."

[System calls ontology.create("Project", {...})]

Agent: "Great! I've created the project 'Website Redesign' with status 'planning'.
       I've set the description to 'Redesign company website for better conversion'.
       Is there anything else you'd like to add about the project itself?"
```
