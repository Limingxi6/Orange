const DISEASE_LABEL_MAP = Object.freeze({
  anthracnose: '疑似炭疽病',
  authracnose: '疑似炭疽病',
  canker: '疑似柑橘溃疡病',
  'citrus canker': '疑似柑橘溃疡病',
  greening: '疑似黄龙病',
  huanglongbing: '疑似黄龙病',
  hlb: '疑似黄龙病',
  mite: '疑似红蜘蛛危害',
  'red mite': '疑似红蜘蛛危害',
  'red spider': '疑似红蜘蛛危害',
  'black spot': '疑似黑斑病',
  black_spot: '疑似黑斑病',
  melanose: '疑似黑点病',
  normal: '叶片状态正常',
  healthy: '叶片状态正常',
  'leaf normal': '叶片状态正常',
  'leaf-normal': '叶片状态正常',
});

const SEVERITY_TEXT_MAP = Object.freeze({
  high: '高',
  mid: '中',
  low: '低',
});

const DISEASE_INLINE_TEXT_MAP = Object.freeze({
  anthracnose: '炭疽病',
  authracnose: '炭疽病',
  canker: '柑橘溃疡病',
  'citrus canker': '柑橘溃疡病',
  greening: '黄龙病',
  huanglongbing: '黄龙病',
  hlb: '黄龙病',
  melanose: '黑点病',
  'black spot': '黑斑病',
  black_spot: '黑斑病',
  mite: '红蜘蛛危害',
  'red mite': '红蜘蛛危害',
  'red spider': '红蜘蛛危害',
});

function _normalizeLabelKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSeverityCode(raw) {
  const value = String(raw || '').toLowerCase();
  if (value === 'high' || value === 'mid' || value === 'low') return value;
  if (value.includes('高')) return 'high';
  if (value.includes('中')) return 'mid';
  if (value.includes('低')) return 'low';
  return 'low';
}

function toSeverityText(raw) {
  const code = normalizeSeverityCode(raw);
  return SEVERITY_TEXT_MAP[code] || '低';
}

function localizeDiseaseLabel(raw) {
  const value = String(raw || '').trim();
  if (!value) return '未知结果';
  if (/[\u4e00-\u9fff]/.test(value)) return value;

  const normalized = _normalizeLabelKey(value);
  if (DISEASE_LABEL_MAP[normalized]) {
    return DISEASE_LABEL_MAP[normalized];
  }

  if (normalized.includes('authracnose') || normalized.includes('anthracnose')) {
    return DISEASE_LABEL_MAP.anthracnose;
  }
  if (normalized.includes('canker')) {
    return DISEASE_LABEL_MAP.canker;
  }
  if (normalized.includes('greening') || normalized.includes('huanglongbing') || /\bhlb\b/.test(normalized)) {
    return DISEASE_LABEL_MAP.greening;
  }
  if (normalized.includes('black spot') || normalized.includes('blackspot')) {
    return DISEASE_LABEL_MAP['black spot'];
  }
  if (normalized.includes('melanose')) {
    return DISEASE_LABEL_MAP.melanose;
  }
  if (normalized.includes('red spider') || normalized.includes('red mite') || normalized === 'mite') {
    return DISEASE_LABEL_MAP.mite;
  }
  if (normalized === 'normal' || normalized === 'healthy' || normalized === 'leaf normal') {
    return DISEASE_LABEL_MAP.normal;
  }

  return value;
}

function localizeDiseaseText(raw) {
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  if (!value) return value;

  let text = value
    .replace(
      /current result is uncertain;?\s*manual review is recommended\.?/gi,
      '当前结果不确定，建议人工复核。',
    )
    .replace(/disease recognition advice/gi, '病害识别建议')
    .replace(/manual review is recommended\.?/gi, '建议人工复核。')
    .replace(/for reference only/gi, '仅供参考')
    .replace(/retake( a)? clear close-?up photo/gi, '补拍清晰近景图片')
    .replace(/within\s*24\s*(hours?|h)/gi, '24小时内')
    .replace(/current recognition confidence is low/gi, '当前识别置信度较低')
    .replace(/current result/gi, '当前结果')
    .replace(/manual review/gi, '人工复核')
    .replace(/review/gi, '复核')
    .replace(/recommended/gi, '建议')
    .replace(/recommend/gi, '建议')
    .replace(/uncertain/gi, '不确定')
    .replace(/confidence/gi, '置信度')
    .replace(/risk level/gi, '风险等级')
    .replace(/\bhigh\b/gi, '高')
    .replace(/\bmid\b/gi, '中')
    .replace(/\blow\b/gi, '低');

  Object.keys(DISEASE_INLINE_TEXT_MAP).forEach((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), DISEASE_INLINE_TEXT_MAP[key]);
  });

  return text;
}

module.exports = {
  localizeDiseaseLabel,
  localizeDiseaseText,
  normalizeSeverityCode,
  toSeverityText,
};
