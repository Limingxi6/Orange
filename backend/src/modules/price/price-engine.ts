import {
  CHANNEL_COEFF,
  DEFAULT_CHANNEL,
  DEFAULT_PACKAGE,
  GRADE_BASE_PRICE,
  PACKAGE_COEFF,
} from './price.constants';

export type GradeInput = {
  diameter?: number;
  brix?: number;
  defectLevel?: 'low' | 'mid' | 'high';
};

export type GradeResult = {
  grade: 'A' | 'B' | 'C';
  basePrice: number;
};

export type PriceResult = {
  grade: 'A' | 'B' | 'C';
  basePrice: number;
  finalPrice: number;
  channelCoeff: number;
  packageCoeff: number;
  priceRange: { min: number; max: number };
  suggestion: string;
};

/**
 * 分级规则：
 * - A: diameter>=75 且 brix>=12 且 defect=low
 * - B: diameter>=68 且 brix>=10 且 defect!=high
 * - 其他 C
 */
export function determineGrade(input: GradeInput): GradeResult {
  const diameter = input.diameter ?? 0;
  const brix = input.brix ?? 0;
  const defect = input.defectLevel ?? 'mid';

  if (diameter >= 75 && brix >= 12 && defect === 'low') {
    return { grade: 'A', basePrice: GRADE_BASE_PRICE.A };
  }
  if (diameter >= 68 && brix >= 10 && defect !== 'high') {
    return { grade: 'B', basePrice: GRADE_BASE_PRICE.B };
  }
  return { grade: 'C', basePrice: GRADE_BASE_PRICE.C };
}

export function calculatePrice(params: {
  grade: 'A' | 'B' | 'C';
  channel?: string;
  packageType?: string;
}): PriceResult {
  const channel = params.channel || DEFAULT_CHANNEL;
  const packageType = params.packageType || DEFAULT_PACKAGE;

  const basePrice = GRADE_BASE_PRICE[params.grade];
  const channelCoeff = CHANNEL_COEFF[channel] ?? 1;
  const packageCoeff = PACKAGE_COEFF[packageType] ?? 1;
  const finalPrice = Number((basePrice * channelCoeff * packageCoeff).toFixed(2));
  const priceRange = {
    min: Number((finalPrice * 0.92).toFixed(2)),
    max: Number((finalPrice * 1.08).toFixed(2)),
  };

  const suggestion = buildSuggestion({
    grade: params.grade,
    channel,
    packageType,
    finalPrice,
    priceRange,
  });

  return {
    grade: params.grade,
    basePrice,
    finalPrice,
    channelCoeff,
    packageCoeff,
    priceRange,
    suggestion,
  };
}

export function buildSuggestion(input: {
  grade: 'A' | 'B' | 'C';
  channel: string;
  packageType: string;
  finalPrice: number;
  priceRange: { min: number; max: number };
}) {
  const gradeText = input.grade === 'A' ? '一级果' : input.grade === 'B' ? '二级果' : '三级果';
  return `建议按${gradeText}在${input.channel}渠道销售，${input.packageType}包装建议价约 ${input.finalPrice} 元/斤，合理区间 ${input.priceRange.min}-${input.priceRange.max} 元/斤。`;
}

