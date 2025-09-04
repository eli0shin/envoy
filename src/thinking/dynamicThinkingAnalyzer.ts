export type ThinkingLevel = 'none' | 'low' | 'medium' | 'high';

export type MessageThinkingAnalysis = {
  level: ThinkingLevel;
  budgetTokens: number;
  enableInterleaved: boolean;
};

/**
 * Analyzes a user message to determine thinking requirements
 *
 * Keywords (Claude Code's complete trigger word list):
 * Low (4,000 tokens): "think"
 * Medium (10,000 tokens): "think about it", "think a lot", "think deeply", "think hard", "think more", "megathink"
 * High (31,999 tokens): "think harder", "think intensely", "think longer", "think really hard", "think super hard", "think very hard", "ultrathink"
 * Interleaved: "step by step" → Enable interleaved thinking header (independent of budget)
 *
 * @param message - The user message to analyze
 * @returns Analysis result with thinking level, budget, and interleaved flag
 */
export function analyzeMessageForThinking(
  message: string
): MessageThinkingAnalysis {
  const lowerMessage = message.toLowerCase();

  // Check for interleaved thinking (only "step by step" needed)
  const enableInterleaved = /\bstep\s+by\s+step\b(?!-|\w)/.test(lowerMessage);

  // Priority-based pattern matching for budget (most specific first)
  // Following Claude Code's complete trigger word implementation
  let level: ThinkingLevel = 'none';
  let budgetTokens = 0;

  // High thinking budget (31,999 tokens) - most specific patterns first
  if (
    /\bthink\s+harder\b/.test(lowerMessage) ||
    /\bthink\s+intensely\b/.test(lowerMessage) ||
    /\bthink\s+longer\b/.test(lowerMessage) ||
    /\bthink\s+really\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+super\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+very\s+hard\b/.test(lowerMessage) ||
    /\bultrathink\b/.test(lowerMessage)
  ) {
    level = 'high';
    budgetTokens = 31999;
  }
  // Medium thinking budget (10,000 tokens)
  else if (
    /\bthink\s+about\s+it\b/.test(lowerMessage) ||
    /\bthink\s+a\s+lot\b/.test(lowerMessage) ||
    /\bthink\s+deeply\b/.test(lowerMessage) ||
    /\bthink\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+more\b/.test(lowerMessage) ||
    /\bmegathink\b/.test(lowerMessage)
  ) {
    level = 'medium';
    budgetTokens = 10000;
  }
  // Low thinking budget (4,000 tokens) - basic "think"
  else if (/\bthink\b/.test(lowerMessage)) {
    level = 'low';
    budgetTokens = 4000;
  }

  return {
    level,
    budgetTokens,
    enableInterleaved,
  };
}
