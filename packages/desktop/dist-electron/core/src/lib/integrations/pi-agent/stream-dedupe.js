"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendStreamDelta = appendStreamDelta;
exports.getVisibleStreamDelta = getVisibleStreamDelta;
exports.trimRepeatingTail = trimRepeatingTail;
exports.reconcileFinalStreamContent = reconcileFinalStreamContent;
const MAX_OVERLAP_SCAN = 65536;
const DUPLICATE_PREFIX_MIN_LENGTH = 32;
const DEFAULT_REPEATING_TAIL_MIN_LENGTH = 120;
const DEFAULT_REPEATING_TAIL_MAX_LENGTH = 2400;
const DEFAULT_REPEATING_TAIL_MIN_REPETITIONS = 3;
const DEFAULT_REPEATING_TAIL_SCAN_LENGTH = 12000;
const DEFAULT_FUZZY_PATTERN_STEP = 16;
const DEFAULT_FUZZY_SIMILARITY_THRESHOLD = 0.92;
function longestSuffixPrefixOverlap(left, right) {
    const leftTail = left.length > MAX_OVERLAP_SCAN ? left.slice(-MAX_OVERLAP_SCAN) : left;
    const rightHead = right.length > MAX_OVERLAP_SCAN ? right.slice(0, MAX_OVERLAP_SCAN) : right;
    const max = Math.min(leftTail.length, rightHead.length);
    for (let length = max; length > 0; length -= 1) {
        if (leftTail.endsWith(rightHead.slice(0, length))) {
            return length;
        }
    }
    return 0;
}
function appendStreamDelta(current, delta) {
    if (!delta)
        return current;
    if (!current)
        return delta;
    if (delta === current)
        return current;
    if (delta.startsWith(current))
        return delta;
    if (delta.length >= DUPLICATE_PREFIX_MIN_LENGTH && current.startsWith(delta))
        return current;
    if (current.endsWith(delta))
        return current;
    const overlap = longestSuffixPrefixOverlap(current, delta);
    return current + delta.slice(overlap);
}
function getVisibleStreamDelta(current, delta) {
    const content = appendStreamDelta(current, delta);
    if (content === current) {
        return { content, delta: '' };
    }
    if (content.startsWith(current)) {
        return { content, delta: content.slice(current.length) };
    }
    return { content, delta };
}
function countTailRepetitions(text, pattern) {
    if (!pattern)
        return 0;
    let count = 0;
    let offset = text.length;
    while (offset >= pattern.length && text.slice(offset - pattern.length, offset) === pattern) {
        count += 1;
        offset -= pattern.length;
    }
    return count;
}
function hasEnoughSignal(pattern) {
    const compact = pattern.replace(/\s+/g, '');
    if (compact.length < 40)
        return false;
    const uniqueChars = new Set([...compact]).size;
    if (uniqueChars < 16)
        return false;
    const wordLikeTokens = pattern
        .split(/[\s，。！？；：、,.!?;:()[\]{}"'`]+/)
        .filter((token) => token.length >= 2);
    return wordLikeTokens.length >= 8 || /[\u4e00-\u9fff]/.test(pattern);
}
function normalizeForNearDuplicate(text) {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[0-9０-９]+/g, '#')
        .replace(/[，。！？；：、,.!?;:()[\]{}"'`<>《》【】\-_=+*\\/|]+/g, '')
        .trim();
}
function buildBigrams(text) {
    const grams = new Map();
    if (text.length < 2) {
        if (text)
            grams.set(text, 1);
        return grams;
    }
    for (let i = 0; i < text.length - 1; i += 1) {
        const gram = text.slice(i, i + 2);
        grams.set(gram, (grams.get(gram) ?? 0) + 1);
    }
    return grams;
}
function diceSimilarity(left, right) {
    if (left === right)
        return 1;
    if (!left || !right)
        return 0;
    const leftNorm = normalizeForNearDuplicate(left);
    const rightNorm = normalizeForNearDuplicate(right);
    if (!leftNorm || !rightNorm)
        return 0;
    if (leftNorm === rightNorm)
        return 1;
    const leftBigrams = buildBigrams(leftNorm);
    const rightBigrams = buildBigrams(rightNorm);
    let overlap = 0;
    for (const [gram, leftCount] of leftBigrams.entries()) {
        const rightCount = rightBigrams.get(gram) ?? 0;
        overlap += Math.min(leftCount, rightCount);
    }
    const leftSize = Array.from(leftBigrams.values()).reduce((sum, count) => sum + count, 0);
    const rightSize = Array.from(rightBigrams.values()).reduce((sum, count) => sum + count, 0);
    if (leftSize === 0 || rightSize === 0)
        return 0;
    return (2 * overlap) / (leftSize + rightSize);
}
function countFuzzyTailRepetitions(text, patternLength, similarityThreshold) {
    if (patternLength <= 0 || text.length < patternLength)
        return 0;
    const pattern = text.slice(text.length - patternLength);
    let count = 1;
    let offset = text.length - patternLength;
    while (offset >= patternLength) {
        const candidate = text.slice(offset - patternLength, offset);
        const similarity = diceSimilarity(pattern, candidate);
        if (similarity < similarityThreshold) {
            break;
        }
        count += 1;
        offset -= patternLength;
    }
    return count;
}
function trimRepeatingTail(content, options = {}) {
    const minPatternLength = options.minPatternLength ?? DEFAULT_REPEATING_TAIL_MIN_LENGTH;
    const maxPatternLength = options.maxPatternLength ?? DEFAULT_REPEATING_TAIL_MAX_LENGTH;
    const minRepetitions = options.minRepetitions ?? DEFAULT_REPEATING_TAIL_MIN_REPETITIONS;
    const scanLength = options.scanLength ?? DEFAULT_REPEATING_TAIL_SCAN_LENGTH;
    const fuzzyPatternStep = DEFAULT_FUZZY_PATTERN_STEP;
    const fuzzySimilarityThreshold = DEFAULT_FUZZY_SIMILARITY_THRESHOLD;
    if (content.length < minPatternLength * minRepetitions) {
        return { content, trimmed: false };
    }
    const scanStart = Math.max(0, content.length - scanLength);
    const tail = content.slice(scanStart);
    const maxLength = Math.min(maxPatternLength, Math.floor(tail.length / minRepetitions));
    for (let length = maxLength; length >= minPatternLength; length -= 1) {
        const pattern = tail.slice(tail.length - length);
        if (!hasEnoughSignal(pattern)) {
            continue;
        }
        const repetitions = countTailRepetitions(tail, pattern);
        if (repetitions >= minRepetitions) {
            const removedChars = pattern.length * (repetitions - 1);
            return {
                content: content.slice(0, content.length - removedChars),
                trimmed: true,
                pattern,
                repetitions,
                removedChars,
            };
        }
    }
    for (let length = maxLength; length >= minPatternLength; length -= fuzzyPatternStep) {
        const pattern = tail.slice(tail.length - length);
        if (!hasEnoughSignal(pattern)) {
            continue;
        }
        const repetitions = countFuzzyTailRepetitions(tail, length, fuzzySimilarityThreshold);
        if (repetitions >= minRepetitions) {
            const removedChars = length * (repetitions - 1);
            return {
                content: content.slice(0, content.length - removedChars),
                trimmed: true,
                pattern,
                repetitions,
                removedChars,
            };
        }
    }
    return { content, trimmed: false };
}
function reconcileFinalStreamContent(streamed, finalContent) {
    if (!finalContent)
        return streamed;
    if (!streamed)
        return finalContent;
    if (finalContent === streamed)
        return streamed;
    if (finalContent.startsWith(streamed)) {
        return appendStreamDelta(streamed, finalContent.slice(streamed.length));
    }
    if (streamed.startsWith(finalContent)) {
        return appendStreamDelta(finalContent, streamed.slice(finalContent.length));
    }
    return finalContent;
}
