# Usage Examples

## Starting a New Project

### Via React Hook

```typescript
import { useProjectInitialization } from '@/lib/skills/project-initialization';

function CreateProjectPage() {
  const { startInitialization, session, isLoading, error } = useProjectInitialization();

  const handleCreate = async (name: string) => {
    await startInitialization(name);
  };

  return (
    <button onClick={() => handleCreate('My Project')}>
      Create Project
    </button>
  );
}
```

### Via API Directly

```typescript

const response = await fetch('/api/projects/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectName: 'My Project',
    projectId: 'proj-custom-001',
    initialContext: {
      domain: 'software-development',
    },
  }),
});

const { data } = await response.json();
console.log('Session ID:', data.sessionId);
```

## Sending Messages

```typescript
// via hook
const { sendMessage } = useProjectInitialization();
const response = await sendMessage(sessionId, "I'm building a website for my company");

// via API
const response = await fetch(`/api/projects/init/${sessionId}/message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "I'm building a website for my company",
  }),
});

const result = await response.json();
console.log('Agent response:', result.data.response.message);
```

## Getting Context

```typescript
const response = await fetch(`/api/projects/init/${sessionId}/context`);
const { data } = await response.json();

console.log('Phase:', data.phase);
console.log('Entities created:', data.entitiesCreated);
console.log('Conversation history:', data.conversation);
```

## Completing the Interview

```typescript
// via hook
const { complete } = useProjectInitialization();
const result = await complete(sessionId);

// via API
const response = await fetch(`/api/projects/init/${sessionId}/complete`, {
  method: 'POST',
});

const { data } = await response.json();
console.log('Project created:', data.projectId);
```

## Cancelling the Interview

```typescript
// via hook
const { cancel } = useProjectInitialization();
await cancel(sessionId);

// via API
await fetch(`/api/projects/init/${sessionId}/cancel`, {
  method: 'POST',
});
```

## Full Example Component

```typescript
'use client';

import { useState } from 'react';
import { useProjectInitialization } from '@/lib/skills/project-initialization';

export function ProjectInitializationWizard() {
  const [projectName, setProjectName] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);

  const {
    session,
    isLoading,
    error,
    startInitialization,
    sendMessage,
    complete,
    cancel,
  } = useProjectInitialization();

  const handleStart = async () => {
    if (!projectName) return;
    await startInitialization(projectName);
    setMessages([{ role: 'system', content: `Started initialization for ${projectName}` }]);
  };

  const handleSend = async () => {
    if (!userMessage || !session) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    const response = await sendMessage(session.sessionId, userMessage);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: response.message,
    }]);

    setUserMessage('');

    if (response.phase === 'review') {
      // Show review button
    }

    if (response.complete) {
      await complete(session.sessionId);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    const result = await complete(session.sessionId);
    console.log('Project completed:', result);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {!session ? (
        <div>
          <h2>Create New Project</h2>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            className="w-full p-2 border rounded mb-4"
          />
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            {isLoading ? 'Starting...' : 'Start Initialization'}
          </button>
        </div>
      ) : (
        <div>
          <h2>Initializing: {projectName}</h2>

          {/* Messages */}
          <div className="min-h-[400px] mb-4 p-4 border rounded overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <span className={`inline-block px-3 py-1 rounded ${
                  msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {msg.content}
                </span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 p-2 border rounded"
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !userMessage}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Send
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Complete
            </button>
            <button
              onClick={() => cancel(session.sessionId)}
              className="px-4 py-2 bg-gray-500 text-white rounded"
            >
              Cancel
            </button>
          </div>

          {/* Phase indicator */}
          <div className="mt-4 text-sm text-gray-500">
            Current Phase: {session.projectContext?.phase}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
```

## Example Conversation Flow

```
[Start Initialization]

User: "My Website"

Agent: "Hello! I'd love to help you create a new project called 'My Website'.
         Could you tell me a bit about what you're working on?"

User: "I'm building a company website that showcases our products"

Agent: "Great! I've created the project 'My Website' with an appropriate description.
         I've set the status to 'planning'. Now, tell me about the key people involved
         in this project."

User: "Alice is the designer, Bob is the developer"

Agent: "I've added Alice and Bob to the project team as Person entities.
         Any other team members, or shall we talk about project goals?"

User: "What about goals?"

Agent: "Excellent! Now let's define the goals. What are the main objectives
         for this project?"

User: "Complete the homepage design by end of month"

Agent: "I've added a goal: 'Complete the homepage design by end of month'.
         More goals, or shall we move on to defining tasks?"

User: "Design wireframes, implement responsive layout, launch site"

Agent: "I've added 3 tasks to the project:
         - Design wireframes
         - Implement responsive layout
         - Launch site

         More tasks, or would you like to review everything and complete the setup?"

User: "Review"

Agent: "Here's a summary of what we've created:

         **Project:** My Website
         - Team: 2 person(s)
         - Goals: 1 goal(s)
         - Tasks: 3 task(s)

         **Team:**
         - Alice (Team Member)
         - Bob (Team Member)

         **Goals:**
         - Complete the homepage design by end of month

         **Tasks:**
         - Design wireframes
         - Implement responsive layout
         - Launch site

         Would you like to modify anything, or shall we complete the setup?"

User: "Complete"

Agent: "Excellent! Your project 'My Website' has been created successfully.
         I've updated the project status to 'active' and all entities are now in
         the ontology. You can start working on your tasks. Good luck!"

[Complete - Project created, entities stored in ontology]
```
