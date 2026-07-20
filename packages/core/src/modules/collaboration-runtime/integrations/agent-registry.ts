/**
 * AgentRegistry — loads Agent definitions from Solution Manifest and project .md files.
 *
 * Reuses parseAgentDefinition / parseToolDefinition from persistent-agent.ts.
 * Only collects metadata; does NOT instantiate PersistentAgent.
 */

import fs from "fs/promises";
import path from "path";

import type { AgentDefinitionParser } from "../config";
import type { AgentNode } from "../session/types";

// Minimal shape of the manifest agent entry
interface ManifestAgent {
  id: string;
  name: string;
  type: string;
  domain: string;
  responsibility: string;
  dataOperations?: Record<string, string[]>;
  skills?: Array<{ id: string; name: string; code: string }>;
  collaborations?: Array<{
    target: string;
    type: string;
    description: string;
  }>;
}

interface SolutionManifest {
  agents: ManifestAgent[];
}

export class AgentRegistry {
  private agents: Map<string, AgentNode> = new Map();
  private parser: AgentDefinitionParser;

  constructor(parser: AgentDefinitionParser) {
    this.parser = parser;
  }

  /**
   * Load all Agent definitions from a Solution Manifest JSON file.
   * Uses projectDir to find individual Agent.md/Tool.md files.
   */
  async loadFromManifest(
    manifestPath: string,
    projectDir: string
  ): Promise<AgentNode[]> {
    const content = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as SolutionManifest;

    const nodes: AgentNode[] = [];
    for (const manifestAgent of manifest.agents) {
      const node = await this.loadAgentDefinition(
        projectDir,
        manifestAgent.id,
        manifestAgent
      );
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Load a single Agent definition from project directory.
   * Merges manifest metadata with Agent.md / Tool.md content.
   */
  async loadAgentDefinition(
    projectDir: string,
    agentId: string,
    manifestAgent?: ManifestAgent
  ): Promise<AgentNode> {
    // Try to load Agent.md from project directory
    let responsibility = manifestAgent?.responsibility ?? "";
    let capabilities: string[] = [];
    let domain = manifestAgent?.domain ?? "";
    let name = manifestAgent?.name ?? agentId;
    let skills: string[] = [];
    let dataOperations: Record<string, string[]> =
      manifestAgent?.dataOperations ?? {};

    // Try reading Agent.md for enriched definitions
    const agentMdPath = path.join(
      projectDir,
      "agents",
      agentId,
      "Agent.md"
    );
    try {
      const agentMdContent = await fs.readFile(agentMdPath, "utf-8");
      const parsed = this.parser.parseAgentDefinition(agentMdContent) as { content?: string; name?: string } | undefined;
      if (parsed?.content) {
        responsibility = parsed.content;
      }
      if (!name || name === agentId) {
        name = parsed?.name ?? name;
      }
      // Extract capabilities from Agent.md content (simple text extraction)
      capabilities = this.extractCapabilities(agentMdContent);
    } catch {
      // Fall back to manifest or use defaults
      if (!responsibility) {
        responsibility = `Agent: ${agentId}`;
      }
    }

    // Try reading Tool.md for allowed tools
    const toolMdPath = path.join(projectDir, "agents", agentId, "Tool.md");
    try {
      const toolMdContent = await fs.readFile(toolMdPath, "utf-8");
      const toolDef = this.parser.parseToolDefinition(toolMdContent) as { allowedTools?: string[] } | undefined;
      // Add allowed tools as skills
      if (toolDef?.allowedTools) {
        for (const tool of toolDef.allowedTools) {
          if (!skills.includes(tool)) {
            skills.push(tool);
          }
        }
      }
    } catch {
      // Tool.md not found, skip
    }

    // Merge skills from manifest
    if (manifestAgent?.skills) {
      for (const skill of manifestAgent.skills) {
        if (!skills.includes(skill.name)) {
          skills.push(skill.name);
        }
      }
    }

    if (!domain) {
      domain = "general";
    }

    const node: AgentNode = {
      id: agentId,
      name,
      domain,
      responsibility,
      capabilities,
      dataOperations,
      skills,
    };

    this.agents.set(agentId, node);
    return node;
  }

  /**
   * Get an Agent by ID.
   */
  getAgent(id: string): AgentNode | null {
    return this.agents.get(id) ?? null;
  }

  /**
   * List all registered Agents.
   */
  listAgents(): AgentNode[] {
    return Array.from(this.agents.values());
  }

  /**
   * Extract capabilities from Agent.md content.
   * Looks for bullet points or capability-like lines.
   */
  private extractCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      // Bullet points: "- does something" or "* does something"
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch?.[1] && bulletMatch[1].length > 3 && bulletMatch[1].length < 200) {
        capabilities.push(bulletMatch[1]);
      }
    }

    return capabilities;
  }
}
