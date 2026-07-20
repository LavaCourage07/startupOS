/**
 * WordPiece Tokenizer — 用于 all-MiniLM-L6-v2 ONNX 推理。
 *
 * 加载 models/vocab.txt（BERT 标准词表），将文本转为 input_ids / attention_mask / token_type_ids。
 * 最大序列长度 128（模型训练配置）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { getMonorepoRoot } from '../../../lib/paths';

const MAX_SEQ_LEN = 128;
const UNK_TOKEN = '[UNK]';
const CLS_TOKEN = '[CLS]';
const SEP_TOKEN = '[SEP]';
const PAD_TOKEN = '[PAD]';

export class WordPieceTokenizer {
  private vocab: Map<string, number> = new Map();
  private ids: Map<number, string> = new Map();
  private loaded = false;

  load(vocabPath: string): void {
    const lines = fs.readFileSync(vocabPath, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const token = lines[i]?.trim() ?? '';
      if (!token) continue;
      this.vocab.set(token, i);
      this.ids.set(i, token);
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  encode(text: string): { inputIds: number[]; attentionMask: number[]; tokenTypeIds: number[] } {
    const clsId = this.vocab.get(CLS_TOKEN) ?? 101;
    const sepId = this.vocab.get(SEP_TOKEN) ?? 102;
    const padId = this.vocab.get(PAD_TOKEN) ?? 0;
    const unkId = this.vocab.get(UNK_TOKEN) ?? 100;

    const tokens = this.tokenize(text);
    // [CLS] tokens [SEP], truncate to MAX_SEQ_LEN - 2
    const truncated = tokens.slice(0, MAX_SEQ_LEN - 2);
    const ids = [clsId, ...truncated.map((t) => this.vocab.get(t) ?? unkId), sepId];

    const attentionMask = new Array(ids.length).fill(1);

    // Pad to MAX_SEQ_LEN
    while (ids.length < MAX_SEQ_LEN) {
      ids.push(padId);
      attentionMask.push(0);
    }

    return {
      inputIds: ids,
      attentionMask,
      tokenTypeIds: new Array(MAX_SEQ_LEN).fill(0),
    };
  }

  private tokenize(text: string): string[] {
    const result: string[] = [];
    // Basic whitespace + punctuation pre-tokenization
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    for (const word of words) {
      result.push(...this.wordPiece(word));
    }
    return result;
  }

  private wordPiece(word: string): string[] {
    if (this.vocab.has(word)) return [word];

    const tokens: string[] = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let found = '';
      while (start < end) {
        const substr = (start === 0 ? '' : '##') + word.slice(start, end);
        if (this.vocab.has(substr)) {
          found = substr;
          break;
        }
        end--;
      }
      if (!found) return [UNK_TOKEN];
      tokens.push(found);
      start = end;
    }
    return tokens;
  }
}

export const wordPieceTokenizer = new WordPieceTokenizer();

/** 尝试从 models/vocab.txt 加载词表，失败则静默跳过（TF-IDF fallback 仍可用） */
export function tryLoadVocab(): void {
  const vocabPath = path.join(getMonorepoRoot(), 'models', 'vocab.txt');
  if (fs.existsSync(vocabPath)) {
    try {
      wordPieceTokenizer.load(vocabPath);
    } catch {
      // vocab 加载失败不影响 TF-IDF fallback
    }
  }
}
