/**
 * Type definitions for thinking/reasoning capabilities
 */

export type ThinkingConfig = {
  enabled: boolean;
  budgetTokens?: number;
  provider?: 'anthropic' | 'openai' | 'google';
  effort?: 'low' | 'medium' | 'high'; // For OpenAI
  thinkingBudget?: number; // For Google
};

export type ThinkingBudgetConfig = {
  anthropic: {
    defaultBudget: number;
    maxBudget: number;
    costMultiplier: number;
  };
  openai: {
    defaultEffort: 'low' | 'medium' | 'high';
    efforts: Array<'low' | 'medium' | 'high'>;
  };
  google: {
    defaultBudget: number;
    maxBudget: number;
    costMultiplier: number;
  };
};

export type ThinkingStreamPart =
  | {
      type: 'reasoning';
      textDelta: string;
    }
  | {
      type: 'reasoning-signature';
      signature: string;
    }
  | {
      type: 'redacted-reasoning';
      data: string;
    };

export type ThinkingMetadata = {
  thinking?: boolean;
  thinkingContent?: string;
  isThinkingComplete?: boolean;
  thinkingTokens?: number;
  thinkingSignature?: string;
};
