export const GRADE_BASE_PRICE: Record<'A' | 'B' | 'C', number> = {
  A: 7.2,
  B: 5.8,
  C: 4.3,
};

export const CHANNEL_COEFF: Record<string, number> = {
  ecommerce: 1.08,
  wholesale: 0.9,
  stall: 0.96,
  supermarket: 1.03,
  // 中文兼容
  电商: 1.08,
  批发: 0.9,
  摆摊: 0.96,
  商超: 1.03,
};

export const PACKAGE_COEFF: Record<string, number> = {
  simple: 1.0,
  gift: 1.15,
  premium: 1.25,
  // 中文兼容
  简装: 1.0,
  礼盒: 1.15,
  精品礼盒: 1.25,
};

export const DEFAULT_CHANNEL = 'ecommerce';
export const DEFAULT_PACKAGE = 'simple';

