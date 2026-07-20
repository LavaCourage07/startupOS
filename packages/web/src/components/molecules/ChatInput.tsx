/**
 * ChatInput Component
 * A textarea with submit functionality for chat messages
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@originos/core/lib/utils";

// ============================================================================
// Props
// ============================================================================

export interface ChatInputProps {
	/**
	 * Callback when user submits a message
	 */
	onSubmit: (text: string) => void | Promise<void>;

	/**
	 * Whether the input is disabled (e.g., when agent is processing)
	 */
	disabled?: boolean;

	/**
	 * Placeholder text for the textarea
	 */
	placeholder?: string;

	/**
	 * Maximum character count
	 */
	maxLength?: number;

	/**
	 * Additional className for styling
	 */
	className?: string;

	/**
	 * Initial value
	 */
	defaultValue?: string;

	/**
	 * Controlled value (use this OR defaultValue)
	 */
	value?: string;

	/**
	 * Callback when value changes
	 */
	onChange?: (value: string) => void;

	/**
	 * Focus the input on mount
	 */
	autoFocus?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ChatInput component for entering chat messages
 *
 * @example
 * ```tsx
 * function MyChat() {
 *   const { sendMessage, isThinking } = usePiAgent();
 *
 *   return (
 *     <ChatInput
 *       onSubmit={sendMessage}
 *       disabled={isThinking}
 *       placeholder="输入消息..."
 *     />
 *   );
 * }
 * ```
 */
export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
	(
		{
			onSubmit,
			disabled = false,
			placeholder = "输入消息，按 Enter 发送，Shift+Enter 换行...",
			maxLength = 2000,
			className,
			defaultValue = "",
			value: controlledValue,
			onChange,
			autoFocus = false,
		},
		ref
	) => {
		// Internal state for uncontrolled mode
		const [internalValue, setInternalValue] = React.useState(defaultValue);
		const textareaRef =
			React.useRef<HTMLTextAreaElement>(
				null
			) as React.MutableRefObject<HTMLTextAreaElement | null>;

		// Auto-resize textarea
		const autoResize = React.useCallback(() => {
			const textarea = (textareaRef.current || (ref && typeof ref === 'object' ? ref!.current : null)) as HTMLTextAreaElement | null;
			if (textarea) {
				textarea.style.height = "auto";
				textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
			}
		}, [ref]);

		// Determine if using controlled or uncontrolled mode
		const isControlled = controlledValue !== undefined;
		const value = isControlled ? controlledValue : internalValue;

		// Handle value change
		const handleChange = React.useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value;
				if (!isControlled) {
					setInternalValue(newValue);
				}
				onChange?.(newValue);
				// Auto-resize after change
				setTimeout(autoResize, 0);
			},
			[isControlled, onChange, autoResize]
		);

		// Handle key down for Enter/Shift+Enter
		const handleKeyDown = React.useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					if (value.trim() && !disabled) {
						onSubmit(value.trim());
						if (!isControlled) {
							setInternalValue("");
						}
					}
				}
			},
			[value, onSubmit, disabled, isControlled]
		);

		// Handle submit button click
		const handleSubmit = React.useCallback(() => {
			if (value.trim() && !disabled) {
				onSubmit(value.trim());
				if (!isControlled) {
					setInternalValue("");
				}
			}
		}, [value, onSubmit, disabled, isControlled]);

		// Auto-resize on mount and when value changes
		React.useEffect(() => {
			if (autoFocus && textareaRef.current) {
				textareaRef.current.focus();
			}
		}, [autoFocus]);

		React.useEffect(() => {
			autoResize();
		}, [value, autoResize]);

		// Merge refs
		const setRef = (node: HTMLTextAreaElement | null) => {
			textareaRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		};

		const charCount = value.length;
		const isNearLimit = maxLength > 0 && charCount > maxLength * 0.9;
		const isAtLimit = maxLength > 0 && charCount >= maxLength;
		const canSubmit = value.trim().length > 0 && !disabled && !isAtLimit;

		return (
			<div className={cn("flex flex-col gap-2", className)}>
				<div className="relative flex items-end gap-2">
					<Textarea
						ref={setRef}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={disabled}
						maxLength={maxLength}
						className={cn(
							"min-h-[60px] max-h-[200px] resize-none pr-12",
							disabled && "opacity-50"
						)}
						rows={1}
					/>
					<Button
						type="button"
						onClick={handleSubmit}
						disabled={!canSubmit}
						size="icon"
						className={cn(
							"absolute right-2 bottom-2",
							"transition-opacity",
							canSubmit ? "opacity-100" : "opacity-40"
						)}
						aria-label="发送消息"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M5 12h14" />
							<path d="m12 5 7 7-7 7" />
						</svg>
					</Button>
				</div>

				{/* Character count */}
				{maxLength > 0 && (
					<div className="flex justify-end">
						<span
							className={cn(
								"text-xs text-muted-foreground",
								isNearLimit && !isAtLimit && "text-orange-500",
								isAtLimit && "text-destructive"
							)}
						>
							{charCount}/{maxLength}
						</span>
					</div>
				)}
			</div>
		);
	}
);

ChatInput.displayName = "ChatInput";

// ============================================================================
// Exports
// ============================================================================

export default ChatInput;
