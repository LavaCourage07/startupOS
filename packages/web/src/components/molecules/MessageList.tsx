/**
 * MessageList Component
 * Displays conversation history with user and agent messages
 */

import * as React from "react";

import { cn } from "@originos/core/lib/utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Message role types
 */
export type MessageRole = "user" | "assistant" | "system" | "tool" | "toolResult";

/**
 * Message data structure
 */
export interface Message {
	/**
	 * Unique identifier
	 */
	id: string;

	/**
	 * Message role
	 */
	role: MessageRole;

	/**
	 * Message content
	 */
	content: string;

	/**
	 * Timestamp
	 */
	timestamp?: number;

	/**
	 * Tool execution info (for tool messages)
	 */
	toolInfo?: {
		name: string;
		arguments?: Record<string, unknown>;
		result?: string | unknown;
		duration?: number;
	};

	/**
	 * Error state
	 */
	error?: boolean;
}

// ============================================================================
// Props
// ============================================================================

export interface MessageListProps {
	/**
	 * Array of messages to display
	 */
	messages?: Message[];

	/**
	 * Additional className for styling
	 */
	className?: string;

	/**
	 * Maximum number of messages to display (default: unlimited)
	 */
	maxMessages?: number;

	/**
	 * Auto-scroll to latest message
	 * @default true
	 */
	autoScroll?: boolean;

	/**
	 * Show timestamps
	 * @default true
	 */
	showTimestamps?: boolean;

	/**
	 * Show avatars
	 * @default true
	 */
	showAvatars?: boolean;

	/**
	 * Custom user avatar
	 */
	userAvatar?: React.ReactNode;

	/**
	 * Custom agent avatar
	 */
	agentAvatar?: React.ReactNode;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * User avatar icon
 */
function UserAvatar() {
	return (
		<div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
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
				className="text-primary"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</div>
	);
}

/**
 * Agent avatar icon
 */
function AgentAvatar() {
	return (
		<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
			<div className="relative">
				<div className="w-1.5 h-1.5 rounded-full bg-primary" />
				<div className="absolute -right-1.5 top-0 w-1.5 h-1.5 rounded-full bg-primary" />
				<div className="absolute -left-1 top-1 w-1.5 h-1.5 rounded-full bg-primary" />
				<div className="absolute -right-1 top-1 w-1.5 h-1.5 rounded-full bg-primary" />
			</div>
		</div>
	);
}

/**
 * Tool execution indicator
 */
function ToolIndicator({ toolName, duration }: { toolName: string; duration?: number }) {
	return (
		<div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
			</svg>
			<span>{toolName}</span>
			{duration && <span className="text-muted-foreground/60">({duration}ms)</span>}
		</div>
	);
}

/**
 * Timestamp display
 */
function Timestamp({ timestamp }: { timestamp?: number }) {
	if (!timestamp) return null;
	const date = new Date(timestamp);
	const time = date.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
	 minute: "2-digit",
		hour12: false,
	});
	return (
		<span className="text-xs text-muted-foreground/60 whitespace-nowrap">
			{time}
		</span>
	);
}

// ============================================================================
// MessageList Component
// ============================================================================

/**
 * Displays a list of conversation messages
 *
 * @example
 * ```tsx
 * function MyChat() {
 *   const { messages } = usePiAgent();
 *
 *   return (
 *     <MessageList
 *       messages={messages}
 *       autoScroll={true}
 *       showTimestamps={true}
 *     />
 *   );
 * }
 * ```
 */
export const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
	(
		{
			messages = [],
			className,
			maxMessages,
			autoScroll = true,
			showTimestamps = true,
			showAvatars = true,
			userAvatar,
			agentAvatar,
		},
		forwardedRef
	) => {
		const listRef = React.useRef<HTMLDivElement>(null);
		const endRef = React.useRef<HTMLDivElement>(null);

		// Merge refs
		const setRef = (node: HTMLDivElement | null) => {
			(listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
			if (typeof forwardedRef === "function") {
				forwardedRef(node);
			} else if (forwardedRef) {
				forwardedRef.current = node;
			}
		};

		// Auto-scroll to latest message
		React.useEffect(() => {
			if (autoScroll && messages.length > 0) {
				endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
			}
		}, [messages, autoScroll]);

		// Limit messages if maxMessages is set
		const displayMessages = React.useMemo(() => {
			if (maxMessages && messages.length > maxMessages) {
				return messages.slice(-maxMessages);
			}
			return messages;
		}, [messages, maxMessages]);

		if (displayMessages.length === 0) {
			return (
				<div
					ref={setRef}
					className={cn("flex-1 flex items-center justify-center", className)}
				>
					<p className="text-sm text-muted-foreground">
						开始对话吧...
					</p>
				</div>
			);
		}

		return (
			<div ref={setRef} className={cn("flex-1 overflow-y-auto space-y-4", className)}>
				{displayMessages.map((message) => {
					const isUser = message.role === "user";
					const isError = message.error;

					return (
						<div
							key={message.id}
							className={cn(
								"flex gap-3",
								isUser ? "flex-row-reverse" : "flex-row"
							)}
						>
							{/* Avatar */}
							{showAvatars && (
								<div className="shrink-0">
									{userAvatar ? (
										<React.Fragment>{userAvatar}</React.Fragment>
									) : isUser ? (
										<UserAvatar />
									) : agentAvatar ? (
										<React.Fragment>{agentAvatar}</React.Fragment>
									) : (
										<AgentAvatar />
									)}
								</div>
							)}

							{/* Message Content */}
							<div
								className={cn(
									"flex flex-col gap-1",
									isUser ? "items-end" : "items-start",
									"max-w-[calc(100%-3rem)]"
								)}
							>
								{/* Message Bubble */}
								<div
									className={cn(
										"rounded-lg px-4 py-2",
										isUser
											? "bg-primary text-foreground"
											: "bg-muted text-foreground",
										isError && "border border-destructive/50"
									)}
								>
									{/* Tool indicator for agent messages */}
									{!isUser && message.toolInfo && (
										<div className="mb-2">
											<ToolIndicator
												toolName={message.toolInfo.name}
												duration={message.toolInfo.duration}
											/>
										</div>
									)}

									{/* Message Content */}
									<p
										className={cn(
											"text-sm",
											isError && "text-destructive"
										)}
									>
										{message.content}
									</p>
								</div>

								{/* Timestamp */}
								{showTimestamps && message.timestamp && (
									<Timestamp timestamp={message.timestamp} />
								)}
							</div>
						</div>
					);
				})}

				{/* Scroll anchor */}
				<div ref={endRef} />
			</div>
		);
	}
);

MessageList.displayName = "MessageList";

// ============================================================================
// Exports
// ============================================================================

export default MessageList;
