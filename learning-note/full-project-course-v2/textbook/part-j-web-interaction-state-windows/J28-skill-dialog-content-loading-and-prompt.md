# J28：SkillDialog 内容加载与 Prompt 构建

## Skill 会话的第一步不是聊天，而是“备课”

打开一个 Skill 窗口时，系统先要知道这个 Skill 教 Agent 做什么、工作目录在哪、产物输出到哪、只读参考资料又从哪读。`SkillDialog` 前 220 行做的正是这件事：加载技能内容，构造 system prompt。

## 第一段源码：技能内容加载器

[packages/web/src/components/skills/SkillDialog.tsx 第 59–98 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L59)：

```ts
async function loadSkillContent(skillName: string): Promise<{
  content: string;
  baseDir?: string;
  workingDir?: string;
  outputDir?: string;
  systemManaged: boolean;
}> {
  try {
    const data = await getAvailableSkillContent({ name: skillName });
    if (data.success && data.data?.content) {
      return {
        content: String(data.data.content),
        baseDir: data.data.baseDir,
        workingDir: data.data.workingDir,
        outputDir: data.data.outputDir,
        systemManaged: data.data.systemManaged,
      };
    }
  } catch (error) {
    console.warn(`[loadSkillContent] Failed to load skill content for ${skillName}, trying agents API...`);
  }

  // Fallback: try loading from agents API (for role agents launched as skills)
  try {
    const data = await getAgentContent(skillName);
    if (data.success && data.data?.content) {
      return {
        content: String(data.data.content),
        baseDir: data.data.baseDir,
        workingDir: data.data.workingDir,
        outputDir: data.data.outputDir,
        systemManaged: true,
      };
    }
  } catch (error) {
    console.error(`[loadSkillContent] Failed to load agent content for ${skillName}:`, error);
  }

  return { content: '', systemManaged: true };
}
```

`loadSkillContent` 做了两层容错：

1. 先调 Skill API `getAvailableSkillContent` 读取 SKILL.md；
2. 失败则回退到 Agent API `getAgentContent`，支持以 Skill 形式启动的 Role Agent。

返回值里有四个关键字段：

- `content`：SKILL.md 文本，后续用于构建 prompt；
- `baseDir`：技能**源目录**，只读，Agent 可以读参考文件，但不应该写；
- `workingDir`：工作目录，Agent 的 CWD，认知文件（Memory.md、practice/）所在；
- `outputDir`：产物输出目录，Agent 生成的文件应该放这里；
- `systemManaged`：是否系统管理，影响导出按钮是否显示。

## 第二段源码：构建 Skill 系统提示词

[packages/web/src/components/skills/SkillDialog.tsx 第 103–221 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L103)：

```ts
function buildSkillSystemPrompt(skillName: string, skillContent: string, skillDir?: string, workDir?: string, outputDir?: string): string {
  const lines: string[] = [];

  // === Working Directory (CWD + 认知文件目录) ===
  if (workDir) {
    lines.push(`Working directory: ${workDir}`);
    lines.push('');
    lines.push('All bash commands and cognitive files (Memory.md, practice/) are resolved from this directory.');
    lines.push('');
  }

  // === Output Directory (产物输出目录) ===
  if (outputDir && outputDir !== workDir) {
    lines.push(`Output directory for artifacts: ${outputDir}`);
    lines.push('');
    lines.push('Use `${OUTPUT_DIR}` in shell commands only when you need the native absolute artifact directory.');
    lines.push('When calling file tools, do NOT pass absolute paths. Use runtime data-root paths instead: `data/agents/{agent-id}/...` for Agents and `data/skills/{skill-code}/...` for Skills.');
    lines.push('Legacy short paths `agents/...` and `skills/...` are also mapped to the runtime data root when this skill runs from `data/skills/{skill}`.');
    lines.push('');
  } else if (outputDir && outputDir === workDir) {
    lines.push(`Output directory for artifacts: ${outputDir}`);
    lines.push('');
  }

  // === Skill Assets Directory (技能源目录，只读) ===
  if (skillDir) {
    lines.push(`Skill assets directory: ${skillDir}`);
    lines.push('Use this directory to read reference files and templates only. Do NOT write output files here.');
    lines.push('You can use ${CLAUDE_SKILL_DIR} in shell commands to reference this directory.');
    lines.push('');
  }

  // === Skill Instructions ===
  if (!skillContent) {
    lines.push(`You are a helpful assistant for ${skillName}.`);
    lines.push('');
    lines.push('Help users with their requests in a conversational and helpful way. Provide clear, step-by-step responses and show progress as you work.');
  } else {
    const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    let displayName = skillName;
    if (frontmatterMatch?.[1]) {
      const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
      if (nameMatch?.[1]) displayName = nameMatch[1].trim();

      const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
      if (descMatch?.[1]) displayName = descMatch[1].trim();
    }

    const bodyWithoutFrontmatter = frontmatterMatch
      ? skillContent.slice(frontmatterMatch[0].length).trim()
      : skillContent;

    lines.push(`You are ${displayName}.`);
    lines.push('');
    lines.push('## Skill Instructions');
    lines.push(bodyWithoutFrontmatter);
  }

  // === How to Execute ===
  lines.push('');
  lines.push('## How to Execute');
  lines.push('When the user gives a request:');
  lines.push('1. Understand their intent from natural language');
  lines.push('2. Determine the operation type (create, update, query, delete, etc.)');
  lines.push('3. Provide clear, step-by-step progress updates');
  lines.push('4. Deliver the final result in a clear format');
  lines.push('');
  lines.push('Be conversational and helpful! Show progress as you work.');

  // === Tool Execution Rules ===
  lines.push('');
  lines.push('## Tool Execution Rules');
  lines.push('You have access to built-in tools that can perform actions on behalf of the user.');
  lines.push('');
  lines.push('IMPORTANT: When you decide to use a tool, call it directly without asking the user for confirmation.');
  lines.push('The system automatically handles tool execution. Do NOT pause to ask "Do you want me to..." or "Should I..." before calling a tool.');
  lines.push('');
  lines.push('Examples:');
  lines.push('- GOOD: User says "save the model" → Immediately call write_file to save it.');
  lines.push('- BAD: User says "save the model" → Ask "Would you like me to save it?" → Wait for confirmation → Then save.');
  lines.push('');
  lines.push('Only ask the user for input when you need information you don\'t already have, not for tool execution approval.');

  // === Network Access Authorization ===
  lines.push('');
  lines.push('## Network Access');
  lines.push('You are explicitly authorized to make HTTP/HTTPS requests to external services using the execute_command tool.');
  lines.push('Network access to any external service is allowed for fulfilling skill requirements, including:');
  lines.push('- Fetching data from external APIs (e.g., skill market, search services)');
  lines.push('- Downloading files from URLs (e.g., GitHub ZIP, ClawHub packages)');
  lines.push('- Web scraping and content extraction from any domain');
  lines.push('Do NOT warn the user about external network access — it is a granted capability.');
  lines.push('');

  // === User Communication Rules ===
  lines.push('');
  lines.push('## User Communication Rules');
  lines.push('Never expose internal implementation details to the user.');
  lines.push('Do NOT mention file paths, directory paths, or internal technical concepts in your responses.');
  lines.push('Focus on what you are doing and the results, not how it is implemented internally.');

  let result = lines.join('\n');

  if (skillDir) {
    result = result.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir);
  }

  if (outputDir) {
    result = result.replace(/\$\{OUTPUT_DIR\}/g, outputDir);
  }

  return result;
}
```

这个函数是 Skill 系统的“教案编写器”。它输出的 system prompt 包含几个固定章节：

1. **Working Directory**：告诉 Agent 当前工作目录在哪，bash 命令和认知文件都从这里解析。
2. **Output Directory**：告诉 Agent 产物输出目录。如果 `outputDir !== workDir`，还会特别说明可以用 `${OUTPUT_DIR}`，但文件工具不要传绝对路径。
3. **Skill Assets Directory**：只读源目录，Agent 可以读参考文件，不能写。
4. **Skill Instructions**：从 SKILL.md 解析 frontmatter 后的正文。
5. **How to Execute / Tool Execution Rules / Network Access / User Communication Rules**：行为约束，例如直接调用工具、不暴露内部路径。

注意其中的变量替换：

- `${CLAUDE_SKILL_DIR}` 替换成 `skillDir`；
- `${OUTPUT_DIR}` 替换成 `outputDir`。

这让 SKILL.md 作者可以在文档里写相对变量，运行时再解析成实际路径。

## 第三段源码：frontmatter 解析的取舍

在 `buildSkillSystemPrompt` 中：

```ts
const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
if (nameMatch?.[1]) displayName = nameMatch[1].trim();

const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
if (descMatch?.[1]) displayName = descMatch[1].trim();
```

这里先取 `name`，再取 `description`，后者会覆盖前者。最终 `displayName` 用于提示词里的 "You are ${displayName}." 这句话。也就是说，`description` 的优先级高于 `name`，这是当前实现的约定。

## 本节小结

- `loadSkillContent` 从 Skill API 加载 SKILL.md，失败时回退到 Agent API。
- 返回的 `baseDir` / `workingDir` / `outputDir` 分别对应：技能源目录、工作目录、产物目录。
- `buildSkillSystemPrompt` 把上述目录信息、技能正文、行为约束组装成 Agent system prompt。
- prompt 里使用 `${CLAUDE_SKILL_DIR}` 和 `${OUTPUT_DIR}` 变量，运行时被替换成实际路径。
- 这套机制让 Skill 内容（Markdown）与运行环境（目录、工具规则）解耦。

下一节课看 `SkillDialog` 如何管理会话：创建、切换、恢复历史会话，以及 `session-transition-guard` 如何防止竞态。
