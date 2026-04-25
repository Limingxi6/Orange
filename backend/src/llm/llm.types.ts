export type LlmRole = 'system' | 'user' | 'assistant';

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmChatOptions = {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
};

export type LlmChatResponse = {
  ok: boolean;
  text: string;
  model?: string;
  raw?: unknown;
  error?: string;
};

export type LlmRuntimeConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
  chatPath: string;
};

export type DiseaseAdviceInput = {
  diseaseName: string;
  confidence: number;
  severity: 'low' | 'mid' | 'high';
  baseSuggestion: string;
};

export type FruitAdviceInput = {
  variety: string;
  grade: string;
  colorScore: number;
  defectRatio: number;
  sizeScore: number;
  maturityScore: number;
  retailMinPrice: number;
  retailMaxPrice: number;
  wholesaleMinPrice: number;
  wholesaleMaxPrice: number;
  channel?: string;
  packageType?: string;
  region?: string;
  factors?: Record<string, unknown>;
  reason?: string;
  riskWarning?: string;
};

export type RiskAdviceInput = {
  orchardName?: string;
  stage?: string;
  level: 'low' | 'mid' | 'high';
  reason: string;
  suggestion: string;
  weatherSummary?: string;
  diseaseSummary?: string;
  hitRules?: Array<{ title: string; reason: string; level?: string }>;
};

export type TraceAdviceInput = {
  title: string;
  payload: unknown;
  audience?: 'farmer' | 'manager' | 'consumer';
};

export type UserQuestionInput = {
  question: string;
  context?: string;
};

export type SuggestionOutput = {
  title: string;
  summary: string;
  actions: string[];
  riskNote?: string;
  raw?: unknown;
};

export type RiskExplainOutput = {
  reason: string;
  suggestion: string;
};

export type LlmTaskMeta = {
  taskType: string;
  promptVersion: string;
  model: string;
  latencyMs: number;
  success: boolean;
  fallback: boolean;
  errorCode?: string;
};

export type LlmTaskResult<T> = {
  content: T;
  fromLlm: boolean;
  rawText?: string;
  meta?: LlmTaskMeta;
};

// Legacy aliases kept for compatibility with existing imports.
export type DiseaseExplainInput = DiseaseAdviceInput;
export type FruitGradeExplainInput = FruitAdviceInput;
export type RiskExplainInput = RiskAdviceInput;
export type TraceSummaryInput = TraceAdviceInput;

