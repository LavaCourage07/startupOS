'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { cn } from '@originos/core/lib/utils';
import { MermaidDiagram } from './MermaidDiagram';

// Register YAML language for syntax highlighting
try {
  rehypeHighlight;
  // highlight.js is auto-loaded by rehype-highlight; register YAML if not already
} catch { /* ignore */ }

export interface ChatMessageData {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
}

// ============================================================================
// AskUserQuestion YAML parsing
// ============================================================================

export interface QuestionOption {
  label: string;
  description: string;
}

export interface ParsedQuestion {
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

interface StructuredQuestionLike {
  question?: unknown;
  options?: unknown;
  multiSelect?: unknown;
}

export function normalizeAskUserQuestion(input: StructuredQuestionLike): ParsedQuestion | null {
  if (typeof input.question !== 'string' || input.question.trim().length === 0) return null;
  if (!Array.isArray(input.options) || input.options.length === 0) return null;

  const options = input.options.flatMap((option) => {
    if (!option || typeof option !== 'object') return [];

    const label = 'label' in option && typeof option.label === 'string'
      ? option.label.trim()
      : '';
    const description = 'description' in option && typeof option.description === 'string'
      ? option.description.trim()
      : '';

    if (!label || !description) return [];
    return [{ label, description }];
  });

  if (options.length === 0) return null;

  return {
    question: input.question.trim(),
    options,
    multiSelect: input.multiSelect === true,
  };
}

export function parseAskUserQuestion(content: string): ParsedQuestion | null {
  const yamlMatch = content.match(/```ya?ml\s*([\s\S]*?)```/);
  if (!yamlMatch?.[1]) return null;

  const yamlContent = yamlMatch[1];

  const questionMatch = yamlContent.match(/question:\s*["']?([^"'\n]+)["']?/);
  if (!questionMatch?.[1]) return null;
  const question = questionMatch[1].trim();

  const options: QuestionOption[] = [];
  const optionsMatch = yamlContent.match(/options:\s*([\s\S]*?)(?=\n\w+|\n\s*$|multiSelect:)/);
  if (optionsMatch?.[1]) {
    const optionsText = optionsMatch[1];
    const optionRegex = /-\s*label:\s*["']?([^"'\n]+)["']?\s*\n\s*description:\s*["']?([^"'\n]+)["']?/g;
    let match;
    while ((match = optionRegex.exec(optionsText)) !== null) {
      if (match[1] && match[2]) {
        options.push({ label: match[1].trim(), description: match[2].trim() });
      }
    }
    if (options.length === 0) {
      const inlineRegex = /-\s*label:\s*["']?([^"'\n]+)["']?\s+description:\s*["']?([^"'\n]+)["']?/g;
      while ((match = inlineRegex.exec(yamlContent)) !== null) {
        if (match[1] && match[2]) {
          options.push({ label: match[1].trim(), description: match[2].trim() });
        }
      }
    }
  }

  if (options.length === 0) return null;

  const multiSelectMatch = yamlContent.match(/multiSelect:\s*(true|false)/i);
  const multiSelect = multiSelectMatch?.[1] ? multiSelectMatch[1].toLowerCase() === 'true' : false;

  return normalizeAskUserQuestion({ question, options, multiSelect });
}

export function removeYamlBlock(content: string): string {
  return content.replace(/```ya?ml\s*[\s\S]*?```/g, '').trim();
}

// ============================================================================
// AskUserQuestion interactive component
// ============================================================================

export function AskUserQuestionComponent({
  parsedQuestion,
  onAnswer,
  disabled,
}: {
  parsedQuestion: ParsedQuestion;
  onAnswer: (selectedLabels: string[]) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleOptionClick = (label: string) => {
    if (disabled) return;
    if (parsedQuestion.multiSelect) {
      const next = new Set(selected);
      next.has(label) ? next.delete(label) : next.add(label);
      setSelected(next);
    } else {
      setSelected(new Set([label]));
      onAnswer([label]);
    }
  };

  const handleSubmit = () => {
    if (selected.size === 0 || disabled) return;
    onAnswer(Array.from(selected));
  };

  return (
    <div className="space-y-3 mt-3">
      <p className="text-sm font-medium text-gray-900">{parsedQuestion.question}</p>
      <div className="space-y-2">
        {parsedQuestion.options.map((option, i) => {
          const isSelected = selected.has(option.label);
          return (
            <button
              key={i}
              onClick={() => handleOptionClick(option.label)}
              disabled={disabled}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-primary/15 border-primary/50 ring-1 ring-primary/30'
                  : 'bg-white/60 border-white/40 hover:border-primary/30 hover:bg-white/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {parsedQuestion.multiSelect ? (
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-400 bg-white'}`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-gray-400'}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 mb-1">{option.label}</div>
                  <div className="text-xs text-gray-600 leading-relaxed">{option.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {parsedQuestion.multiSelect && (
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0 || disabled}
          className="w-full px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          确认选择 {selected.size > 0 && `(${selected.size})`}
        </button>
      )}
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownContent({ content, isStreaming }: MarkdownContentProps) {
  return (
    <div className="min-w-0 overflow-hidden break-words text-inherit">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          strong({ children }) {
            return <strong className="font-bold text-inherit">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-black/20 text-inherit text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Check if it's a mermaid code block
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (language === 'mermaid') {
              const code = String(children).replace(/\n$/, '');
              return <MermaidDiagram chart={code} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre className="max-w-full bg-black/30 rounded-lg p-3 overflow-x-auto text-sm my-2">
                {children}
              </pre>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                {children}
              </a>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="block text-base font-bold text-inherit mt-3 mb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="block text-sm font-bold text-inherit mt-2 mb-1">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="block text-sm font-semibold text-inherit mt-2 mb-0.5">{children}</h3>;
          },
          p({ children }) {
            return <p className="my-1 leading-relaxed text-inherit">{children}</p>;
          },
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full h-auto rounded-lg my-2"
              />
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-current/40 pl-3 my-2 opacity-80">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="max-w-full overflow-x-auto my-2">
                <table className="text-sm border-collapse w-full">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-current/20 px-2 py-1 font-semibold text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-current/20 px-2 py-1">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse opacity-70" />
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageData;
  className?: string;
  /** Called when user selects options from an AskUserQuestion card */
  onAnswer?: (selectedLabels: string[]) => void;
  /** Whether this message's question has already been answered */
  isAnswered?: boolean;
}

export function ChatMessage({ message, className, onAnswer, isAnswered }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className={cn('flex justify-end', className)}>
        <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-primary text-white">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
          {message.timestamp && (
            <div className="text-xs mt-1 text-white/70">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const parsedQuestion = onAnswer ? parseAskUserQuestion(message.content) : null;
  const displayContent = parsedQuestion ? removeYamlBlock(message.content) : message.content;

  return (
    <div className={cn('flex justify-start', className)}>
      <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-gray-100 text-gray-900">
        {displayContent && (
          <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
            <MarkdownContent content={displayContent} isStreaming={message.isStreaming} />
          </div>
        )}
        {parsedQuestion && onAnswer && (
          <AskUserQuestionComponent
            parsedQuestion={parsedQuestion}
            onAnswer={onAnswer}
            disabled={!!isAnswered}
          />
        )}
        {message.timestamp && (
          <div className="text-xs mt-1 text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}
