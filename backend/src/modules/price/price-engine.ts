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
  colorScore?: number;
  sizeScore?: number;
  maturityScore?: number;
  defectRatio?: number;
};

export type GradeResult = {
  grade: 'A' | 'B' | 'C';
  basePrice: number;
  qualityScore: number;
  factors: {
    colorScore: number;
    sizeScore: number;
    maturityScore: number;
    defectRatio: number;
  };
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

const DEFECT_RATIO_BY_LEVEL: Record<'low' | 'mid' | 'high', number> = {
  low: 0.03,
  mid: 0.08,
  high: 0.16,
};

export function determineGrade(input: GradeInput): GradeResult {
  const colorScore = clamp(input.colorScore ?? 72, 0, 100);
  const sizeScore = clamp(input.sizeScore ?? scoreByDiameter(input.diameter), 0, 100);
  const maturityScore = clamp(input.maturityScore ?? scoreByBrix(input.brix), 0, 100);
  const defectRatio = clamp(
    input.defectRatio ?? DEFECT_RATIO_BY_LEVEL[input.defectLevel ?? 'mid'],
    0,
    1,
  );

  const qualityScore = Number(
    (
      colorScore * 0.3 +
      sizeScore * 0.3 +
      maturityScore * 0.25 +
      (1 - defectRatio) * 100 * 0.15
    ).toFixed(2),
  );

  if (
    qualityScore >= 85 &&
    defectRatio <= 0.05 &&
    sizeScore >= 78 &&
    maturityScore >= 78 &&
    colorScore >= 80
  ) {
    return {
      grade: 'A',
      basePrice: GRADE_BASE_PRICE.A,
      qualityScore,
      factors: { colorScore, sizeScore, maturityScore, defectRatio },
    };
  }

  if (
    qualityScore >= 72 &&
    defectRatio <= 0.12 &&
    sizeScore >= 65 &&
    maturityScore >= 65 &&
    colorScore >= 65
  ) {
    return {
      grade: 'B',
      basePrice: GRADE_BASE_PRICE.B,
      qualityScore,
      factors: { colorScore, sizeScore, maturityScore, defectRatio },
    };
  }

  return {
    grade: 'C',
    basePrice: GRADE_BASE_PRICE.C,
    qualityScore,
    factors: { colorScore, sizeScore, maturityScore, defectRatio },
  };
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

function scoreByDiameter(diameter?: number): number {
  if (!diameter || !Number.isFinite(diameter)) {
    return 68;
  }
  return 50 + (diameter - 55) * 1.4;
}

function scoreByBrix(brix?: number): number {
  if (!brix || !Number.isFinite(brix)) {
    return 70;
  }
  return 50 + brix * 3.2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

