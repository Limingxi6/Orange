import { Injectable } from '@nestjs/common';
import {
  DiseaseAdviceInput,
  FruitAdviceInput,
  LlmTaskResult,
  RiskAdviceInput,
  SuggestionOutput,
  TraceAdviceInput,
  UserQuestionInput,
} from '../../llm/llm.types';
import { LlmService } from '../../llm/llm.service';

export type DiseaseNarrativeInput = DiseaseAdviceInput;
export type FruitNarrativeInput = FruitAdviceInput;
export type RiskNarrativeInput = RiskAdviceInput;
export type StructuredNarrativeInput = TraceAdviceInput;

@Injectable()
export class AiNarrativeService {
  constructor(private readonly llmService: LlmService) {}

  async suggestDiseaseAdvice(
    input: DiseaseNarrativeInput,
  ): Promise<LlmTaskResult<SuggestionOutput>> {
    return this.llmService.suggestDiseaseAdvice(input);
  }

  async suggestFruitAdvice(input: FruitNarrativeInput): Promise<LlmTaskResult<SuggestionOutput>> {
    return this.llmService.suggestFruitAdvice(input);
  }

  async suggestRiskAdvice(input: RiskNarrativeInput): Promise<LlmTaskResult<SuggestionOutput>> {
    return this.llmService.suggestRiskAdvice(input);
  }

  async suggestTraceAdvice(
    input: StructuredNarrativeInput,
  ): Promise<LlmTaskResult<SuggestionOutput>> {
    return this.llmService.suggestTraceAdvice(input);
  }

  // Legacy wrappers kept for existing modules.
  async explainDiseaseResult(input: DiseaseNarrativeInput): Promise<string> {
    const out = await this.suggestDiseaseAdvice(input);
    return this.toNarrativeText(out.content);
  }

  async explainFruitGradeResult(input: FruitNarrativeInput): Promise<string> {
    const out = await this.suggestFruitAdvice(input);
    return this.toNarrativeText(out.content);
  }

  async polishRiskAssessment(input: RiskNarrativeInput): Promise<{
    reason: string;
    suggestion: string;
  }> {
    const out = await this.suggestRiskAdvice(input);

    return {
      reason: out.content.summary || input.reason,
      suggestion: out.content.actions.length ? out.content.actions.join('；') : input.suggestion,
    };
  }

  async generateTraceCopy(input: StructuredNarrativeInput): Promise<string> {
    const out = await this.suggestTraceAdvice(input);
    return this.toNarrativeText(out.content);
  }

  async describeStructuredResult(input: StructuredNarrativeInput): Promise<string> {
    const out = await this.suggestTraceAdvice(input);
    return this.toNarrativeText(out.content);
  }

  async answerAssistant(question: string, context?: string): Promise<string> {
    const out = await this.llmService.answerUserQuestion({
      question,
      context,
    } as UserQuestionInput);
    return out.content;
  }

  private toNarrativeText(input: SuggestionOutput): string {
    const parts: string[] = [];
    if (input.summary) parts.push(input.summary);
    if (input.actions.length) parts.push(`建议：${input.actions.join('；')}`);
    if (input.riskNote) parts.push(input.riskNote);
    return parts.join(' ');
  }
}
