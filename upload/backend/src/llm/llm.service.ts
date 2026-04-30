import { Injectable, Logger } from '@nestjs/common';
import {
  buildQaPrompt,
  suggestDiseaseAction,
  suggestFruitGradeAction,
  suggestRiskAction,
  suggestTraceSummary,
  toMessages,
} from './llm.prompts';
import {
  DiseaseAdviceInput,
  DiseaseExplainInput,
  FruitAdviceInput,
  FruitGradeExplainInput,
  LlmTaskMeta,
  LlmTaskResult,
  RiskAdviceInput,
  RiskExplainInput,
  RiskExplainOutput,
  SuggestionOutput,
  TraceAdviceInput,
  TraceSummaryInput,
  UserQuestionInput,
} from './llm.types';
import { LlmClient } from './llm.client';
import { parseStructuredOutput, pickText, toActionList } from './llm.utils';

type ParsedSuggestion = {
  title?: unknown;
  summary?: unknown;
  actions?: unknown;
  riskNote?: unknown;
  text?: unknown;
  reason?: unknown;
  suggestion?: unknown;
  suggestions?: unknown;
  steps?: unknown;
  riskWarning?: unknown;
  warning?: unknown;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly llmClient: LlmClient) {}

  async suggestDiseaseAdvice(input: DiseaseAdviceInput): Promise<LlmTaskResult<SuggestionOutput>> {
    const fallback = this.fallbackDiseaseSuggestion(input);
    const prompt = suggestDiseaseAction(input);

    return this.runSuggestionTask({
      taskType: 'suggestDiseaseAction',
      promptVersion: prompt.promptVersion,
      system: prompt.system,
      user: prompt.user,
      fallback,
      temperature: 0.2,
      maxTokens: 320,
    });
  }

  async suggestFruitAdvice(input: FruitAdviceInput): Promise<LlmTaskResult<SuggestionOutput>> {
    const fallback = this.fallbackFruitSuggestion(input);
    const prompt = suggestFruitGradeAction(input);

    return this.runSuggestionTask({
      taskType: 'suggestFruitGradeAction',
      promptVersion: prompt.promptVersion,
      system: prompt.system,
      user: prompt.user,
      fallback,
      temperature: 0.2,
      maxTokens: 360,
    });
  }

  async suggestRiskAdvice(input: RiskAdviceInput): Promise<LlmTaskResult<SuggestionOutput>> {
    const fallback = this.fallbackRiskSuggestion(input);
    const prompt = suggestRiskAction(input);

    return this.runSuggestionTask({
      taskType: 'suggestRiskAction',
      promptVersion: prompt.promptVersion,
      system: prompt.system,
      user: prompt.user,
      fallback,
      temperature: 0.2,
      maxTokens: 360,
    });
  }

  async suggestTraceAdvice(input: TraceAdviceInput): Promise<LlmTaskResult<SuggestionOutput>> {
    const fallback = this.fallbackTraceSuggestion(input);
    const prompt = suggestTraceSummary(input);

    return this.runSuggestionTask({
      taskType: 'suggestTraceSummary',
      promptVersion: prompt.promptVersion,
      system: prompt.system,
      user: prompt.user,
      fallback,
      temperature: 0.25,
      maxTokens: 300,
    });
  }

  // Legacy methods kept for existing modules/tests.
  async explainDiseaseResult(input: DiseaseExplainInput): Promise<LlmTaskResult<string>> {
    const out = await this.suggestDiseaseAdvice(input);
    return {
      content: this.composeSuggestionText(out.content),
      fromLlm: out.fromLlm,
      rawText: out.rawText,
      meta: out.meta,
    };
  }

  async explainFruitGradeResult(input: FruitGradeExplainInput): Promise<LlmTaskResult<string>> {
    const out = await this.suggestFruitAdvice(input);
    return {
      content: this.composeSuggestionText(out.content),
      fromLlm: out.fromLlm,
      rawText: out.rawText,
      meta: out.meta,
    };
  }

  async explainRiskResult(input: RiskExplainInput): Promise<LlmTaskResult<RiskExplainOutput>> {
    const out = await this.suggestRiskAdvice(input);

    return {
      content: {
        reason: out.content.summary || input.reason,
        suggestion: out.content.actions.length ? out.content.actions.join('；') : input.suggestion,
      },
      fromLlm: out.fromLlm,
      rawText: out.rawText,
      meta: out.meta,
    };
  }

  async generateTraceSummary(input: TraceSummaryInput): Promise<LlmTaskResult<string>> {
    const out = await this.suggestTraceAdvice(input);
    return {
      content: out.content.summary,
      fromLlm: out.fromLlm,
      rawText: out.rawText,
      meta: out.meta,
    };
  }

  async answerUserQuestion(input: UserQuestionInput): Promise<LlmTaskResult<string>> {
    const fallback = input.context
      ? `基于当前信息，建议先核对批次与近7天记录后执行：${input.question}`
      : `请补充批次号或上下文后再提问：${input.question}`;

    const prompt = buildQaPrompt(input);
    const startedAt = Date.now();
    const raw = await this.llmClient.chat(toMessages(prompt.system, prompt.user), {
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 320,
    });
    const latencyMs = Date.now() - startedAt;

    if (!raw.ok) {
      this.logTaskMeta({
        taskType: 'answerUserQuestion',
        promptVersion: 'qa-v1',
        model: raw.model || 'unknown',
        latencyMs,
        success: false,
        fallback: true,
        errorCode: raw.error || 'LLM_CALL_FAILED',
      });
      return {
        content: fallback,
        fromLlm: false,
        meta: {
          taskType: 'answerUserQuestion',
          promptVersion: 'qa-v1',
          model: raw.model || 'unknown',
          latencyMs,
          success: false,
          fallback: true,
          errorCode: raw.error || 'LLM_CALL_FAILED',
        },
      };
    }

    const parsed = parseStructuredOutput<{ text: string }>(raw.text);
    const text = parsed?.text?.trim();

    if (!text) {
      const meta: LlmTaskMeta = {
        taskType: 'answerUserQuestion',
        promptVersion: 'qa-v1',
        model: raw.model || 'unknown',
        latencyMs,
        success: false,
        fallback: true,
        errorCode: 'INVALID_STRUCTURED_OUTPUT',
      };
      this.logTaskMeta(meta);
      return {
        content: fallback,
        fromLlm: false,
        rawText: raw.text,
        meta,
      };
    }

    const meta: LlmTaskMeta = {
      taskType: 'answerUserQuestion',
      promptVersion: 'qa-v1',
      model: raw.model || 'unknown',
      latencyMs,
      success: true,
      fallback: false,
    };
    this.logTaskMeta(meta);

    return {
      content: text,
      fromLlm: true,
      rawText: raw.text,
      meta,
    };
  }

  private async runSuggestionTask(params: {
    taskType: string;
    promptVersion: string;
    system: string;
    user: string;
    fallback: SuggestionOutput;
    temperature: number;
    maxTokens: number;
  }): Promise<LlmTaskResult<SuggestionOutput>> {
    const startedAt = Date.now();
    const raw = await this.llmClient.chat(toMessages(params.system, params.user), {
      responseFormat: 'json',
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    const latencyMs = Date.now() - startedAt;

    if (!raw.ok) {
      const meta: LlmTaskMeta = {
        taskType: params.taskType,
        promptVersion: params.promptVersion,
        model: raw.model || 'unknown',
        latencyMs,
        success: false,
        fallback: true,
        errorCode: raw.error || 'LLM_CALL_FAILED',
      };
      this.logTaskMeta(meta);
      return {
        content: params.fallback,
        fromLlm: false,
        meta,
      };
    }

    const parsed = parseStructuredOutput<ParsedSuggestion>(raw.text);
    if (!parsed) {
      const meta: LlmTaskMeta = {
        taskType: params.taskType,
        promptVersion: params.promptVersion,
        model: raw.model || 'unknown',
        latencyMs,
        success: false,
        fallback: true,
        errorCode: 'INVALID_STRUCTURED_OUTPUT',
      };
      this.logTaskMeta(meta);
      return {
        content: params.fallback,
        fromLlm: false,
        rawText: raw.text,
        meta,
      };
    }

    const normalized = this.normalizeSuggestion(parsed, params.fallback);
    const fromLlm = normalized.fromLlm;
    const meta: LlmTaskMeta = {
      taskType: params.taskType,
      promptVersion: params.promptVersion,
      model: raw.model || 'unknown',
      latencyMs,
      success: fromLlm,
      fallback: !fromLlm,
      errorCode: fromLlm ? undefined : 'EMPTY_SUGGESTION',
    };
    this.logTaskMeta(meta);

    return {
      content: normalized.content,
      fromLlm,
      rawText: raw.text,
      meta,
    };
  }

  private normalizeSuggestion(
    parsed: ParsedSuggestion,
    fallback: SuggestionOutput,
  ): { content: SuggestionOutput; fromLlm: boolean } {
    const summaryCandidate =
      pickText(parsed.summary) || pickText(parsed.text) || pickText(parsed.reason);
    const actionsCandidate = parsed.actions ?? parsed.suggestions ?? parsed.steps ?? parsed.suggestion;

    const normalizedActions = toActionList(actionsCandidate, 3);
    const riskNote =
      pickText(parsed.riskNote) ||
      pickText(parsed.riskWarning) ||
      pickText(parsed.warning) ||
      undefined;
    const title = pickText(parsed.title) || fallback.title;

    if (!summaryCandidate && normalizedActions.length === 0 && !riskNote) {
      return {
        content: fallback,
        fromLlm: false,
      };
    }

    return {
      content: {
        title,
        summary: summaryCandidate || fallback.summary,
        actions: normalizedActions.length > 0 ? normalizedActions : fallback.actions,
        riskNote,
      },
      fromLlm: true,
    };
  }

  private composeSuggestionText(input: SuggestionOutput): string {
    const parts: string[] = [];
    if (input.summary) parts.push(input.summary);
    if (input.actions.length) parts.push(`建议：${input.actions.join('；')}`);
    if (input.riskNote) parts.push(input.riskNote);
    return parts.join(' ');
  }

  private fallbackDiseaseSuggestion(input: DiseaseAdviceInput): SuggestionOutput {
    const levelText = this.levelText(input.severity);
    const confidenceText = `${(input.confidence * 100).toFixed(1)}%`;
    const lowConfidence = input.confidence < 0.65;

    return {
      title: '病害识别建议',
      summary: `当前识别结果为${input.diseaseName}，置信度${confidenceText}，风险等级${levelText}。建议先按基础防控动作处理，并结合现场复拍结果确认症状一致性，避免误判后过度处理。`,
      actions: lowConfidence
        ? ['补拍2-3张清晰近景并记录位置。', '24小时内安排人工复核后再处置。', '优先隔离可疑区域，持续观察扩散。']
        : ['按基础建议先执行首轮处置。', '标记可疑叶片并跟踪24小时变化。', '如症状扩大，及时升级人工复核。'],
      riskNote: lowConfidence ? '当前识别置信度偏低，结果仅供参考。' : undefined,
    };
  }

  private fallbackFruitSuggestion(input: FruitAdviceInput): SuggestionOutput {
    return {
      title: '分级与销售建议',
      summary: `${input.variety}当前评估为${input.grade}，综合了色泽${input.colorScore}分、果径${input.sizeScore}分、成熟度${input.maturityScore}分与缺陷率${input.defectRatio}。价格区间仅用于执行参考，实际出货前仍需结合抽检与行情复核。`,
      actions: ['先按当前等级执行分拣与装箱。', '出货前抽检糖度和外观一致性。', '结合当日渠道行情复核最终报价。'],
      riskNote: input.riskWarning || '建议结合实物抽检和市场波动复核，不直接放大报价。',
    };
  }

  private fallbackRiskSuggestion(input: RiskAdviceInput): SuggestionOutput {
    const levelText = this.levelText(input.level);
    const parsedActions = toActionList(input.suggestion, 3);

    return {
      title: '风险处置建议',
      summary: `当前风险等级为${levelText}，主要依据是${input.reason}。建议按先巡园、后复核、再处理的顺序执行，优先覆盖高风险点位，并持续记录处置结果用于后续复盘。`,
      actions:
        parsedActions.length > 0
          ? parsedActions
          : ['优先巡园复查高风险点位。', '针对可疑区域先做隔离和标记。', '24小时内复评并更新处置记录。'],
      riskNote: `风险等级保持为${levelText}，AI建议仅为处置增强。`,
    };
  }

  private fallbackTraceSuggestion(input: TraceAdviceInput): SuggestionOutput {
    const payload = this.toRecord(input.payload);
    const batchNo = this.pick(payload, ['batchNo', 'batch_id', 'batchId']);
    const orchard = this.pick(payload, ['orchardName', 'origin', '产地']);
    const proofHash = this.pick(payload, ['proofHash', 'chainHash']);

    return {
      title: '溯源说明建议',
      summary: `该商品溯源信息已在系统登记，可追踪批次${batchNo || '信息'}、产地${orchard || '信息'}及关键记录。对外说明建议以系统留存数据为准，验真以校验结果与摘要锚定信息为参考。`,
      actions: [
        '先展示批次与产地等核心信息。',
        '同步展示关键农事记录时间线。',
        proofHash ? '向买家说明可通过摘要校验验真。' : '如缺少验真摘要，建议补齐后再对外说明。',
      ],
      riskNote: '说明内容仅基于系统已有记录，不代表额外质量承诺。',
    };
  }

  private levelText(level: 'low' | 'mid' | 'high'): string {
    if (level === 'high') return '高';
    if (level === 'mid') return '中';
    return '低';
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private pick(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  private logTaskMeta(meta: LlmTaskMeta) {
    const payload = {
      taskType: meta.taskType,
      promptVersion: meta.promptVersion,
      model: meta.model,
      latencyMs: meta.latencyMs,
      success: meta.success,
      fallback: meta.fallback,
      errorCode: meta.errorCode,
    };

    if (meta.fallback) {
      this.logger.warn(`LLM task fallback ${JSON.stringify(payload)}`);
      return;
    }

    this.logger.log(`LLM task success ${JSON.stringify(payload)}`);
  }
}

