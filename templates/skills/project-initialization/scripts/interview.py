#!/usr/bin/env python3
"""
Interview Agent for Project Initialization Skill

Implements the conversational agent that guides users through
project initialization while creating entities in the ontology.

Usage:
    python interview.py --session-id <session_id> --project-id <project_id>
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add ontology skill to path
ONTOLogy_PATH = Path(__file__).parent.parent.parent.parent.joinpath(
    "awesome-openclaw-skills-1/skills/ontology/scripts"
)

if ONTOLogy_PATH.exists():
    sys.path.insert(0, str(ONTOLogy_PATH))
    from ontology import (
        create_entity,
        delete_entity,
        get_entity,
        list_entities,
        query_entities,
        relate as create_relation,
        get_related,
        update_entity,
        validate_graph,
    )
else:
    # Fallback mock implementation for development
    print(f"[WARN] Ontology skill not found at {ONTOLogy_PATH}, using mock")

    def create_entity(type_name, properties, graph_path=None, entity_id=None):
        return {"id": f"{type_name.lower()[:4]}_mock", "type": type_name, "properties": properties}

    def create_relation(from_id, rel_type, to_id, properties=None, graph_path=None):
        return {"from": from_id, "rel": rel_type, "to": to_id}


# Default paths
DEFAULT_GRAPH_PATH = "memory/ontology/graph.jsonl"
DEFAULT_CONTEXT_PATH = "sessions/{session_id}/context.json"


class InterviewPhase:
    """Conversation phases for the interview"""

    FOUNDATION = "foundation"
    TEAM = "team"
    GOALS = "goals"
    TASKS = "tasks"
    REVIEW = "review"
    COMPLETE = "complete"


class InterviewAgent:
    """Agent that conducts project initialization interviews"""

    def __init__(self, session_id: str, project_id: str, graph_path: str = DEFAULT_GRAPH_PATH):
        self.session_id = session_id
        self.project_id = project_id
        self.graph_path = graph_path
        self.phase = InterviewPhase.FOUNDATION
        self.created_entities = []
        self.conversation_history = []

        # Load or create session context
        self.context = self.load_context()

    def load_context(self) -> dict:
        """Load session context from file"""
        context_path = DEFAULT_CONTEXT_PATH.format(session_id=self.session_id)
        context_file = Path(context_path)

        if context_file.exists():
            with open(context_file) as f:
                return json.load(f)

        # Initialize new context
        return {
            "session_id": self.session_id,
            "project_id": self.project_id,
            "phase": InterviewPhase.FOUNDATION,
            "entities_created": [],
            "conversation": [],
            "project_entity_id": None,
        }

    def save_context(self):
        """Save session context to file"""
        context_path = DEFAULT_CONTEXT_PATH.format(session_id=self.session_id)
        context_file = Path(context_path)

        context_file.parent.mkdir(parents=True, exist_ok=True)

        with open(context_file, "w") as f:
            json.dump({
                "session_id": self.session_id,
                "project_id": self.project_id,
                "phase": self.phase,
                "entities_created": self.created_entities,
                "conversation": self.conversation_history,
                "project_entity_id": self.context.get("project_entity_id"),
            }, f, indent=2)

    def process_message(self, user_message: str) -> dict:
        """Process a user message and generate a response"""
        # Add to conversation history
        self.conversation_history.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now().isoformat(),
        })

        # Process based on current phase
        response = self.handle_message_by_phase(user_message)

        # Add to conversation history
        self.conversation_history.append({
            "role": "assistant",
            "content": response["message"],
            "timestamp": datetime.now().isoformat(),
            "entities_created": response.get("entities_created", []),
        })

        # Save context
        self.save_context()

        return response

    def handle_message_by_phase(self, user_message: str) -> dict:
        """Route message to appropriate phase handler"""
        handlers = {
            InterviewPhase.FOUNDATION: self.handle_foundation_phase,
            InterviewPhase.TEAM: self.handle_team_phase,
            InterviewPhase.GOALS: self.handle_goals_phase,
            InterviewPhase.TASKS: self.handle_tasks_phase,
            InterviewPhase.REVIEW: self.handle_review_phase,
            InterviewPhase.COMPLETE: self.handle_complete_phase,
        }

        handler = handlers.get(self.phase)
        if not handler:
            return {
                "message": "I'm not sure what phase we're in. Let me restart the conversation.",
                "phase": InterviewPhase.FOUNDATION,
            }

        return handler(user_message)

    def handle_foundation_phase(self, user_message: str) -> dict:
        """Handle the foundation phase - gathering project info"""
        message_lower = user_message.lower()

        # Check if we have enough info to create the project
        if not self.context.get("project_entity_id"):
            # Extract project info from the message
            # This is a simplified version - in production, use NLP/AI
            project_name = self.extract_project_name(user_message)
            project_desc = self.extract_description(user_message)

            if project_name:
                # Create the project entity
                project = create_entity("Project", {
                    "name": project_name,
                    "description": project_desc,
                    "status": "planning",
                }, self.graph_path)

                self.context["project_entity_id"] = project["id"]
                self.created_entities.append(project["id"])

                return {
                    "message": (
                        f"Great! I've created the project '{project_name}'. "
                        f"{project_desc if project_desc else 'Is there anything else you want to add about the project itself?'}"
                        f"\n\nNow, tell me about the key people involved in this project."
                    ),
                    "entities_created": [project],
                    "phase": InterviewPhase.TEAM,
                }

        # If we already have a project, move to team phase
        if self.context.get("project_entity_id"):
            self.phase = InterviewPhase.TEAM
            return {
                "message": "Let's talk about the team. Who are the key people involved in this project?",
                "phase": InterviewPhase.TEAM,
            }

        return {
            "message": "Could you tell me more about the project? What's its main purpose or goal?",
            "phase": InterviewPhase.FOUNDATION,
        }

    def handle_team_phase(self, user_message: str) -> dict:
        """Handle the team phase - adding team members"""
        message_lower = user_message.lower()

        # Check for transitions
        if "no team" in message_lower or "just me" in message_lower or "solo" in message_lower:
            self.phase = InterviewPhase.GOALS
            return {
                "message": "Got it, it's a solo project. Let's move on to goals. What are you trying to achieve with this project?",
                "phase": InterviewPhase.GOALS,
            }

        if "goal" in message_lower or "objective" in message_lower or "done with team" in message_lower:
            self.phase = InterviewPhase.GOALS
            return {
                "message": "Excellent! Now let's define the goals. What are the main objectives for this project?",
                "phase": InterviewPhase.GOALS,
            }

        # Extract person info and create entities
        persons_created = []
        persons = self.extract_persons(user_message)

        project_id = self.context.get("project_entity_id")
        if project_id and persons:
            for person_data in persons:
                person = create_entity("Person", person_data, self.graph_path)
                create_relation(project_id, "has_owner", person["id"], graph_path=self.graph_path)
                self.created_entities.append(person["id"])
                persons_created.append(person)

            return {
                "message": (
                    f"I've added {len(persons)} person(s) to the project team. "
                    f"Any other team members, or shall we talk about project goals?"
                ),
                "entities_created": persons_created,
                "phase": InterviewPhase.TEAM,
            }

        return {
            "message": "Could you tell me who's on the team? You can mention names, roles, or just count.",
            "phase": InterviewPhase.TEAM,
        }

    def handle_goals_phase(self, user_message: str) -> dict:
        """Handle the goals phase - defining project goals"""
        message_lower = user_message.lower()

        if "task" in message_lower or "work" in message_lower or "done with goals" in message_lower:
            self.phase = InterviewPhase.TASKS
            return {
                "message": "Great! Now let's talk about the actual work. What are the initial tasks you need to do?",
                "phase": InterviewPhase.TASKS,
            }

        # Extract goals and create entities
        goals_created = []
        goals = self.extract_goals(user_message)

        project_id = self.context.get("project_entity_id")
        if project_id and goals:
            for goal_data in goals:
                goal = create_entity("Goal", goal_data, self.graph_path)
                create_relation(project_id, "has_goal", goal["id"], graph_path=self.graph_path)
                self.created_entities.append(goal["id"])
                goals_created.append(goal)

            msg = f"I've added {len(goals)} goal(s) to the project. "
            if len(goals) == 1 and goals[0].get("target_date"):
                msg += f"The goal is targeted for {goals[0]['target_date']}. "

            return {
                "message": msg + "More goals, or shall we move on to defining tasks?",
                "entities_created": goals_created,
                "phase": InterviewPhase.GOALS,
            }

        return {
            "message": "What are the main goals or milestones for this project?",
            "phase": InterviewPhase.GOALS,
        }

    def handle_tasks_phase(self, user_message: str) -> dict:
        """Handle the tasks phase - defining initial tasks"""
        message_lower = user_message.lower()

        if "review" in message_lower or "done" in message_lower or "complete" in message_lower:
            self.phase = InterviewPhase.REVIEW
            return self.generate_review()

        # Extract tasks and create entities
        tasks_created = []
        tasks = self.extract_tasks(user_message)

        project_id = self.context.get("project_entity_id")
        if project_id and tasks:
            for task_data in tasks:
                # Add project reference
                task_data["project"] = project_id
                task = create_entity("Task", task_data, self.graph_path)
                create_relation(project_id, "has_task", task["id"], graph_path=self.graph_path)
                self.created_entities.append(task["id"])
                tasks_created.append(task)

            return {
                "message": (
                    f"I've added {len(tasks)} task(s) to the project. "
                    "More tasks, or would you like to review everything and complete the setup?"
                ),
                "entities_created": tasks_created,
                "phase": InterviewPhase.TASKS,
            }

        return {
            "message": "What are the initial tasks that need to be done? You can list them or describe each one.",
            "phase": InterviewPhase.TASKS,
        }

    def handle_review_phase(self, user_message: str) -> dict:
        """Handle the review phase"""
        message_lower = user_message.lower()

        if "complete" in message_lower or "finish" in message_lower or "yes" in message_lower:
            return self.complete_interview()

        if "modify" in message_lower or "change" in message_lower or "edit" in message_lower:
            return {
                "message": "Sure! What would you like to change? You can tell me the entity and what to modify.",
                "phase": InterviewPhase.REVIEW,
            }

        # Default to completion if ambiguous
        return self.complete_interview()

    def handle_complete_phase(self, user_message: str) -> dict:
        """Handle the complete phase - after interview is done"""
        return {
            "message": "The project has been created successfully! You can now start working on it.",
            "phase": InterviewPhase.COMPLETE,
            "complete": True,
        }

    def generate_review(self) -> dict:
        """Generate a review of what was created"""
        project_id = self.context.get("project_entity_id")

        if not project_id:
            return {
                "message": "It seems the project wasn't created properly. Let me restart the conversation.",
                "phase": InterviewPhase.FOUNDATION,
            }

        # Gather information about created entities
        persons = get_related(project_id, "has_owner", self.graph_path, "outgoing")
        goals = get_related(project_id, "has_goal", self.graph_path, "outgoing")
        tasks = get_related(project_id, "has_task", self.graph_path, "outgoing")

        project = get_entity(project_id, self.graph_path)
        project_name = project["properties"]["name"] if project else "Unknown Project"

        review_text = (
            f"Here's a summary of what we've created:\n\n"
            f"**Project:** {project_name}\n"
            f"- Team: {len(persons)} person(s)\n"
            f"- Goals: {len(goals)} goal(s)\n"
            f"- Tasks: {len(tasks)} task(s)\n\n"
        )

        if persons:
            review_text += "**Team:**\n"
            for person in persons:
                name = person["entity"]["properties"]["name"]
                role = person["entity"]["properties"].get("role", "")
                review_text += f"  - {name}" + (f" ({role})" if role else "") + "\n"

        if goals:
            review_text += "**Goals:**\n"
            for goal in goals:
                desc = goal["entity"]["properties"]["description"]
                review_text += f"  - {desc}\n"

        if tasks:
            review_text += "**Tasks:**\n"
            for task in tasks:
                title = task["entity"]["properties"]["title"]
                review_text += f"  - {title}\n"

        review_text += "\nWould you like to modify anything, or shall we complete the setup?"

        return {
            "message": review_text,
            "entities": {
                "persons": len(persons),
                "goals": len(goals),
                "tasks": len(tasks),
            },
            "phase": InterviewPhase.REVIEW,
        }

    def complete_interview(self) -> dict:
        """Complete the interview and finalize the project"""
        project_id = self.context.get("project_entity_id")

        if project_id:
            # Update project status to active
            update_entity(project_id, {"status": "active"}, self.graph_path)

        self.phase = InterviewPhase.COMPLETE

        return {
            "message": (
                "Excellent! Your project has been created successfully.\n\n"
                "I've updated the project status to 'active' and all entities are now in the ontology.\n"
                "You can start working on your tasks. Good luck!"
            ),
            "phase": InterviewPhase.COMPLETE,
            "complete": True,
            "project_id": project_id,
        }

    # ===== Extraction methods (simplified - in production use NLP/AI) =====

    def extract_project_name(self, message: str) -> str:
        """Extract project name from message - simplified version"""
        # This is a placeholder - in production, use NLP/AI
        words = message.split()
        if len(words) > 0:
            # Try to find a capitalized phrase as the project name
            for i, word in enumerate(words):
                if word[0].isupper() and i + 1 < len(words) and words[i + 1][0].isupper():
                    return f"{word} {words[i + 1]}"
            return words[0].capitalize()
        return "Untitled Project"

    def extract_description(self, message: str) -> str:
        """Extract project description from message"""
        # Remove the project name (first few words) and return the rest
        words = message.split()
        if len(words) > 2:
            return " ".join(words[2:])
        return ""

    def extract_persons(self, message: str) -> list[dict]:
        """Extract persons from message - simplified version"""
        persons = []

        # Look for capitalized names
        words = message.split()
        for i, word in enumerate(words):
            if word[0].isupper() and len(word) > 2 and word not in ["The", "And", "But", "Or"]:
                persons.append({"name": word, "role": "Team Member"})

        # Also check for common patterns like "Alice is the lead"
        if "is the" in message.lower():
            parts = message.split("is the", 1)
            if len(parts) == 2:
                name_part = parts[0].strip().split()
                if name_part and name_part[-1][0].isupper():
                    persons.append({
                        "name": name_part[-1],
                        "role": parts[1].split()[0] if parts[1].split() else "Team Member"
                    })

        return persons

    def extract_goals(self, message: str) -> list[dict]:
        """Extract goals from message - simplified version"""
        goals = []

        # Split by common separators
        parts = [p.strip() for p in message.split(",") if p.strip()]
        parts.extend([p.strip() for p in message.split("and") if p.strip()])
        parts = list(set(parts))  # Deduplicate

        for part in parts:
            if len(part) > 5:  # Filter out too short fragments
                goals.append({
                    "description": part,
                    "status": "active"
                })

        return goals

    def extract_tasks(self, message: str) -> list[dict]:
        """Extract tasks from message - simplified version"""
        tasks = []

        # Split by common separators
        parts = [p.strip() for p in message.split(",") if p.strip()]
        parts.extend([p.strip() for p in message.split("and") if p.strip()])
        parts = list(set(parts))

        for part in parts:
            if len(part) > 3:
                # Check for action words
                action_words = ["create", "design", "build", "implement", "write", "develop"]
                for action in action_words:
                    if action.lower() in part.lower():
                        tasks.append({
                            "title": part,
                            "status": "open"
                        })
                        break
                else:
                    # No action word found, just use the text
                    tasks.append({
                        "title": part,
                        "status": "open"
                    })

        return tasks


def main():
    parser = argparse.ArgumentParser(description="Interview Agent")
    parser.add_argument("--session-id", required=True, help="Session ID")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--message", help="User message to process")
    parser.add_argument("--graph", default=DEFAULT_GRAPH_PATH, help="Graph file path")

    args = parser.parse_args()

    agent = InterviewAgent(args.session_id, args.project_id, args.graph)

    if args.message:
        # Process a single message
        response = agent.process_message(args.message)
        print(json.dumps(response, indent=2))
    else:
        # Interactive mode
        print("Starting project initialization interview...")
        print("Type your answers or 'quit' to exit.\n")

        while agent.phase != InterviewPhase.COMPLETE:
            user_input = input("You: ").strip()

            if user_input.lower() in ["quit", "exit", "bye"]:
                print("Interview cancelled.")
                break

            response = agent.process_message(user_input)
            print(f"\nAssistant: {response['message']}\n")

            if response.get("complete"):
                print(f"Project ID: {response.get('project_id')}")
                break


if __name__ == "__main__":
    main()
