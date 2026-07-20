/**
 * Dream compatibility helpers.
 *
 * 保留旧 Dream Phase 2 指令语义，但实现下沉到 memory-core，
 * 让 role-agent/dream.ts 只做兼容包装，而不是继续维护独立逻辑。
 */

export interface DreamInstruction {
  type: 'ADD' | 'UPDATE' | 'REMOVE' | 'SKILL';
  content: string;
}

export function parseDreamInstructions(output: string): DreamInstruction[] {
  const instructions: DreamInstruction[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[SKIP]') continue;

    const match = trimmed.match(/^[-*]?\s*\[([A-Z]+)\]\s+(.+)$/);
    if (!match) continue;

    const type = match[1] as DreamInstruction['type'];
    const content = match[2]!;

    if (type === 'ADD' || type === 'UPDATE' || type === 'REMOVE' || type === 'SKILL') {
      instructions.push({ type, content });
    }
  }

  return instructions;
}

export function applyDreamInstructions(
  content: string,
  instructions: DreamInstruction[],
): string {
  let result = content;

  for (const instruction of instructions) {
    switch (instruction.type) {
      case 'ADD':
        result = applyAdd(result, instruction.content);
        break;
      case 'UPDATE':
        result = applyUpdate(result, instruction.content);
        break;
      case 'REMOVE':
        result = applyRemove(result, instruction.content);
        break;
      case 'SKILL':
        break;
    }
  }

  return result;
}

function applyAdd(content: string, text: string): string {
  const sectionHeader = '## 更新记忆';
  const sectionIndex = content.indexOf(sectionHeader);

  if (sectionIndex === -1) {
    return content.endsWith('\n')
      ? `${content}\n${sectionHeader}\n\n- ${text}\n`
      : `${content}\n\n${sectionHeader}\n\n- ${text}\n`;
  }

  const afterHeader = content.slice(sectionIndex + sectionHeader.length);
  const nextSectionMatch = afterHeader.match(/\n## /);
  if (nextSectionMatch) {
    const insertPoint = sectionIndex + sectionHeader.length + nextSectionMatch.index!;
    return `${content.slice(0, insertPoint)}\n- ${text}\n${content.slice(insertPoint)}`;
  }

  return content.endsWith('\n')
    ? `${content}- ${text}\n`
    : `${content}\n- ${text}\n`;
}

function applyUpdate(content: string, text: string): string {
  const prefixLen = Math.min(8, text.length);
  const searchKey = text.slice(0, prefixLen);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.trim().startsWith('- ')) continue;
    if (lines[i]!.includes(searchKey) && !lines[i]!.includes(text)) {
      lines[i] = `- ${text}`;
      return lines.join('\n');
    }
  }

  return applyAdd(content, text);
}

function applyRemove(content: string, text: string): string {
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    if (line.trim() === '## 更新记忆') return true;
    if (!line.trim().startsWith('- ')) return true;
    return !line.includes(text.slice(0, Math.min(40, text.length)));
  });

  return filtered.join('\n');
}
