/**
 * Build request payload for AI chat API.
 * Keeps last N messages as context for two-way conversation.
 */

export const MAX_AI_CONTEXT_MESSAGES = 10;

export type ChatContextMessage = { role: string; content: string };

export function buildAiChatPayload(
  message: string,
  previousMessages: Array<ChatContextMessage>
): { message: string; context?: Array<ChatContextMessage> } {
  const context = previousMessages.slice(-MAX_AI_CONTEXT_MESSAGES);
  return {
    message,
    context: context.length > 0 ? context : undefined,
  };
}
