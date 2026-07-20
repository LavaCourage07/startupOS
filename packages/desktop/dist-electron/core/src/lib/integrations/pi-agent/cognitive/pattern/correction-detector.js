"use strict";
/**
 * 用户纠正信号检测
 *
 * 规则 v1：中英文关键词匹配。
 * 预留 v2 钩子：LLM 二分类（Haiku）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCorrections = detectCorrections;
exports.maxStrength = maxStrength;
const RULES = [
    {
        strength: 'strong',
        patterns: [
            /不对|不是|错了|搞错|不对的|不正确/,
            /重新|重做|再来一?次|换一?种|重试/,
            /wrong|no[,，]?\s*(that'?s?|it'?s?)|incorrect|redo|try again/i,
        ],
    },
    {
        strength: 'medium',
        patterns: [
            /不要|别(?!急|怕)|不需要|去掉|删掉/,
            /应该(?:是|用|为)|应当|漏了|缺了|少了/,
            /don'?t|stop doing|remove that|you missed|should be|should use/i,
        ],
    },
    {
        strength: 'weak',
        patterns: [
            /为什么(?:会|要|这样)|这是什么|这里(?:是|有)/,
            /why did you|what is this|why is/i,
        ],
    },
];
function detectCorrections(userMessage) {
    const signals = [];
    const excerpt = userMessage.slice(0, 120);
    for (const rule of RULES) {
        for (const pat of rule.patterns) {
            const match = pat.exec(userMessage);
            if (match) {
                signals.push({
                    strength: rule.strength,
                    matched: match[0],
                    excerpt,
                });
                break; // one rule hits once
            }
        }
    }
    return signals;
}
/** 从信号列表中取最高强度 */
function maxStrength(signals) {
    if (signals.some(s => s.strength === 'strong'))
        return 'strong';
    if (signals.some(s => s.strength === 'medium'))
        return 'medium';
    if (signals.some(s => s.strength === 'weak'))
        return 'weak';
    return null;
}
