/**
 * API Route: Chat with Ontology
 * POST /api/ontology/[id]/chat
 *
 * Interactive chat interface for ontology editing
 *
 * Note: For MVP, this provides basic echo/store functionality.
 * In production, this would integrate with Claude Code MCP for AI-assisted editing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonStore } from '@originos/core/lib/storage';
import type { ChatRequest, ApiResponse } from '@originos/core/types';
import type { OntologyChat, ChatHistoryRecord } from '@originos/core/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get or create chat for ontology
 */
async function getOrCreateChat(ontologyId: string): Promise<OntologyChat> {
  const chatId = `${ontologyId}-chat`;
  const existing = await jsonStore.read<OntologyChat>(
    jsonStore.getChatPath(chatId),
  );

  if (existing?.data) {
    return existing.data;
  }

  const now = new Date().toISOString();

  // Get ontology to get projectId
  const ontology = await jsonStore.read(
    jsonStore.getOntologyPath(ontologyId),
  );
  const projectId = (ontology?.data as any)?.projectId ?? '';

  const newChat: OntologyChat = {
    id: chatId,
    ontologyId,
    projectId,
    history: [],
    createdAt: now,
    updatedAt: now,
  };

  await jsonStore.write(jsonStore.getChatPath(chatId), {
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    data: newChat,
  });

  return newChat;
}

/**
 * Generate AI response (placeholder for Claude Code integration)
 */
async function generateAIResponse(
  message: string,
  _ontologyId: string,
): Promise<{ text: string; operations?: any[] }> {
  // NOTE: This is a placeholder implementation
  // In production, this would use Claude Code MCP for actual AI understanding
  // For now, return a simple acknowledgment

  const lowerMessage = message.toLowerCase();

  // Simple pattern matching for demonstration
  if (
    lowerMessage.includes('add') &&
    (lowerMessage.includes('domain') || lowerMessage.includes('概念') || lowerMessage.includes('领域'))
  ) {
    return {
      text: 'I can help you add a new domain. What would you like to name it?',
    };
  } else if (
    lowerMessage.includes('add') &&
    (lowerMessage.includes('concept') || lowerMessage.includes('概念'))
  ) {
    return {
      text: 'I can help you add a new concept. Which domain should it belong to?',
    };
  } else if (
    lowerMessage.includes('delete') ||
    lowerMessage.includes('移除') ||
    lowerMessage.includes('删除')
  ) {
    return {
      text: 'Please specify which element you would like to delete from the ontology.',
    };
  } else if (
    lowerMessage.includes('relation') ||
    lowerMessage.includes('relationship') ||
    lowerMessage.includes('关系')
  ) {
    return {
      text: 'I can help you define relationships between concepts. Which entities would you like to connect?',
    };
  } else {
    return {
      text: `I understand you said: "${message}". For ontology editing, you can ask me to add/remove domains, concepts, or define relationships. I can also help clarify the structure of your ontology.`,
    };
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ontologyId } = await params;
    const body: ChatRequest = await _request.json();

    // Validate _request
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'message is required and must be a string',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Get or create chat session
    const chat = await getOrCreateChat(ontologyId);

    // Create user message record
    const userRecord: ChatHistoryRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      role: 'user',
      content: body.message,
    };

    // Generate AI response
    const aiResponse = await generateAIResponse(body.message, ontologyId);

    // Create assistant message record
    const assistantRecord: ChatHistoryRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: aiResponse.text,
      relatedOntologyChanges: aiResponse.operations,
    };

    // Update chat history
    chat.history.push(userRecord, assistantRecord);
    chat.updatedAt = new Date().toISOString();

    // Save updated chat
    await jsonStore.write(jsonStore.getChatPath(chat.id), {
      version: '1.0.0',
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      data: chat,
    });

    return NextResponse.json<ApiResponse<{
      message: string;
      chatId: string;
      historyLength: number;
    }>>(
      {
        success: true,
        data: {
          message: aiResponse.text,
          chatId: chat.id,
          historyLength: chat.history.length,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error in ontology chat:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

/**
 * Get chat history
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ontologyId } = await params;

    const chatId = `${ontologyId}-chat`;
    const chatData = await jsonStore.read<OntologyChat>(
      jsonStore.getChatPath(chatId),
    );

    if (!chatData?.data) {
      return NextResponse.json<ApiResponse<{
        chatId: string;
        history: ChatHistoryRecord[];
      }>>(
        {
          success: true,
          data: {
            chatId,
            history: [],
          },
          timestamp: new Date().toISOString(),
        },
      );
    }

    return NextResponse.json<ApiResponse<{
      chatId: string;
      history: ChatHistoryRecord[];
    }>>(
      {
        success: true,
        data: {
          chatId: chatData.data.id,
          history: chatData.data.history,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting chat history:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
