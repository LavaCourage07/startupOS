"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRuntimeWorkingSummary = buildRuntimeWorkingSummary;
exports.createWorkingSummaryMessage = createWorkingSummaryMessage;
function hasContent(message) {
    return 'content' in message && Array.isArray(message.content);
}
function getTextContent(message) {
    if (!hasContent(message))
        return '';
    return message.content
        .filter((block) => block?.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim();
}
function normalizeLine(text) {
    return text.replace(/\s+/g, ' ').trim();
}
function extractFailureReason(text) {
    const lines = text.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
    for (const line of lines) {
        if (line.includes('失败原因') ||
            line.includes('Error:') ||
            line.includes('error:') ||
            line.includes('not found') ||
            line.includes('不存在')) {
            return line;
        }
    }
    return undefined;
}
function extractDoNotRepeat(text) {
    const lines = text.split('\n').map((line) => normalizeLine(line)).filter(Boolean);
    for (const line of lines) {
        if (line.includes('不要重复') ||
            line.includes('停止重复') ||
            line.includes('不再沿用') ||
            line.includes('换一种方式') ||
            line.includes('改为')) {
            return line;
        }
    }
    return undefined;
}
function buildRuntimeWorkingSummary(messages) {
    const currentTask = [...messages]
        .reverse()
        .find((message) => message.role === 'user');
    const currentTaskText = currentTask ? normalizeLine(getTextContent(currentTask)).slice(0, 200) : undefined;
    let failureReason;
    let doNotRepeat;
    for (const message of [...messages].reverse()) {
        const text = getTextContent(message);
        if (!text)
            continue;
        if (!failureReason) {
            failureReason = extractFailureReason(text);
        }
        if (!doNotRepeat) {
            doNotRepeat = extractDoNotRepeat(text);
        }
        if (failureReason && doNotRepeat) {
            break;
        }
    }
    return {
        currentTask: currentTaskText,
        failureReason,
        doNotRepeat,
    };
}
function createWorkingSummaryMessage(messages) {
    const summary = buildRuntimeWorkingSummary(messages);
    if (!summary.currentTask && !summary.failureReason && !summary.doNotRepeat) {
        return null;
    }
    const lines = ['[Working Summary]'];
    if (summary.currentTask) {
        lines.push(`当前任务：${summary.currentTask}`);
    }
    if (summary.failureReason) {
        lines.push(`最近失败原因：${summary.failureReason}`);
    }
    if (summary.doNotRepeat) {
        lines.push(`禁止重复动作：${summary.doNotRepeat}`);
    }
    const message = {
        role: 'system',
        content: [
            {
                type: 'text',
                text: lines.join('\n'),
            },
        ],
    };
    return message;
}
