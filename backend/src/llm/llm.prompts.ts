import {
  DiseaseAdviceInput,
  DiseaseExplainInput,
  FruitAdviceInput,
  FruitGradeExplainInput,
  LlmMessage,
  RiskAdviceInput,
  RiskExplainInput,
  TraceAdviceInput,
  TraceSummaryInput,
  UserQuestionInput,
} from './llm.types';

export const DISEASE_ADVICE_PROMPT_VERSION = 'suggest-disease-action-v1';
export const FRUIT_ADVICE_PROMPT_VERSION = 'suggest-fruit-grade-action-v1';
export const RISK_ADVICE_PROMPT_VERSION = 'suggest-risk-action-v1';
export const TRACE_ADVICE_PROMPT_VERSION = 'suggest-trace-summary-v1';

export type PromptTemplate = {
  system: string;
  user: string;
  promptVersion: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 0);
  } catch {
    return '{}';
  }
}

function confidenceNotice(confidence: number): string {
  if (confidence < 0.65) {
    return '当前置信度偏低，必须明确提示结果存在不确定性，并建议人工复核。';
  }
  return '可做保守解释，不得夸大结论。';
}

function sharedRules(): string {
  return [
    '约束：',
    '1) 不得修改主判断结果，不得改动任何已有等级、标签、价格、风险级别。',
    '2) 不得编造不存在的数据，不得补充输入中没有的事实。',
    '3) 不得给出超出上下文的强结论，措辞保持保守。',
    '4) 输出中文自然、简洁、可执行。',
    '5) 仅输出 JSON 对象，不要输出 markdown。',
  ].join('\n');
}

function suggestionOutputSchema(extra = ''): string {
  const lines = [
    '输出 JSON：',
    '{',
    '  "title": "建议标题",',
    '  "summary": "80-150字主说明",',
    '  "actions": ["动作1", "动作2", "动作3"],',
    '  "riskNote": "可选，风险或不确定性提示"',
    '}',
    '要求：actions 为 1~3 条，每条不超过 24 字。',
  ];
  if (extra) lines.push(extra);
  return lines.join('\n');
}

export function suggestDiseaseAction(input: DiseaseAdviceInput): PromptTemplate {
  return {
    promptVersion: DISEASE_ADVICE_PROMPT_VERSION,
    system:
      '你是农业病害识别后的建议助手。你的职责是解释结果并给出可执行动作，不能替代病害分类判断。',
    user: [
      suggestionOutputSchema('可结合置信度和严重度增加谨慎提醒。'),
      sharedRules(),
      `病害名称: ${input.diseaseName}`,
      `置信度: ${input.confidence}`,
      `严重度: ${input.severity}`,
      `基础建议: ${input.baseSuggestion}`,
      confidenceNotice(input.confidence),
    ].join('\n'),
  };
}

export function suggestFruitGradeAction(input: FruitAdviceInput): PromptTemplate {
  return {
    promptVersion: FRUIT_ADVICE_PROMPT_VERSION,
    system:
      '你是果实分级与定价建议助手。只能解释结果与建议动作，不得改动任何分级和价格。',
    user: [
      suggestionOutputSchema('可在 riskNote 中提示行情波动和复核建议。'),
      sharedRules(),
      `品种: ${input.variety}`,
      `等级: ${input.grade}`,
      `色泽分: ${input.colorScore}`,
      `缺陷率: ${input.defectRatio}`,
      `果径分: ${input.sizeScore}`,
      `成熟度分: ${input.maturityScore}`,
      `零售价格区间: ${input.retailMinPrice}-${input.retailMaxPrice}`,
      `批发价格区间: ${input.wholesaleMinPrice}-${input.wholesaleMaxPrice}`,
      `渠道: ${input.channel ?? '-'}`,
      `包装: ${input.packageType ?? '-'}`,
      `地区: ${input.region ?? '-'}`,
      `影响因素: ${safeJson(input.factors ?? {})}`,
      `规则说明: ${input.reason ?? '-'}`,
      `风险提示: ${input.riskWarning ?? '-'}`,
    ].join('\n'),
  };
}

export function suggestRiskAction(input: RiskAdviceInput): PromptTemplate {
  return {
    promptVersion: RISK_ADVICE_PROMPT_VERSION,
    system:
      '你是农业风险预警建议助手。风险等级已由规则引擎确定，你只能做解释增强和处置建议排序。',
    user: [
      suggestionOutputSchema('actions 需要按优先级或时间顺序表达。'),
      sharedRules(),
      `风险等级: ${input.level}`,
      `果园: ${input.orchardName ?? '-'}`,
      `阶段: ${input.stage ?? '-'}`,
      `天气摘要: ${input.weatherSummary ?? '-'}`,
      `病害摘要: ${input.diseaseSummary ?? '-'}`,
      `规则命中: ${safeJson(input.hitRules ?? [])}`,
      `规则原因: ${input.reason}`,
      `规则建议: ${input.suggestion}`,
      '建议使用“建议/可考虑/优先”等稳健措辞。',
    ].join('\n'),
  };
}

export function suggestTraceSummary(input: TraceAdviceInput): PromptTemplate {
  return {
    promptVersion: TRACE_ADVICE_PROMPT_VERSION,
    system:
      '你是农产品溯源说明助手，面向买家生成客观可信的溯源说明，不能夸张营销。',
    user: [
      suggestionOutputSchema('重点突出产地、批次、记录完整性、验真锚定信息。'),
      sharedRules(),
      `标题: ${input.title}`,
      `受众: ${input.audience ?? 'consumer'}`,
      `溯源数据: ${safeJson(input.payload)}`,
      '禁止使用“绝对安全”“绝对优质”等绝对化表述。',
    ].join('\n'),
  };
}

// Legacy exports kept for compatibility.
export function buildDiseasePrompt(input: DiseaseExplainInput): { system: string; user: string } {
  const prompt = suggestDiseaseAction(input);
  return {
    system: prompt.system,
    user: prompt.user,
  };
}

export function buildFruitGradePrompt(
  input: FruitGradeExplainInput,
): { system: string; user: string } {
  const prompt = suggestFruitGradeAction(input);
  return {
    system: prompt.system,
    user: prompt.user,
  };
}

export function buildRiskPrompt(input: RiskExplainInput): { system: string; user: string } {
  const prompt = suggestRiskAction(input);
  return {
    system: prompt.system,
    user: prompt.user,
  };
}

export function buildTracePrompt(input: TraceSummaryInput): { system: string; user: string } {
  const prompt = suggestTraceSummary(input);
  return {
    system: prompt.system,
    user: prompt.user,
  };
}

export function buildQaPrompt(input: UserQuestionInput): { system: string; user: string } {
  return {
    system:
      '你是橘源通智能助手。中文回答，简洁可执行，优先安全保守建议；信息不足时明确指出。',
    user: input.context
      ? `问题: ${input.question}\n上下文: ${input.context}\n请输出 JSON：{"text":"..."}`
      : `问题: ${input.question}\n请输出 JSON：{"text":"..."}`,
  };
}

export function toMessages(system: string, user: string): LlmMessage[] {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

