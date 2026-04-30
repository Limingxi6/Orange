import { calculatePrice, determineGrade } from './price-engine';

describe('price-engine', () => {
  it('should return A grade for high quality inputs', () => {
    const result = determineGrade({
      diameter: 78,
      brix: 13,
      defectLevel: 'low',
      colorScore: 90,
    });

    expect(result.grade).toBe('A');
    expect(result.qualityScore).toBeGreaterThan(80);
  });

  it('should return C grade for poor inputs', () => {
    const result = determineGrade({
      diameter: 62,
      brix: 8,
      defectLevel: 'high',
      colorScore: 62,
    });

    expect(result.grade).toBe('C');
  });

  it('should calculate price with channel and package coeff', () => {
    const priced = calculatePrice({
      grade: 'A',
      channel: 'ecommerce',
      packageType: 'gift',
    });

    expect(priced.finalPrice).toBeGreaterThan(priced.basePrice);
    expect(priced.priceRange.min).toBeLessThan(priced.priceRange.max);
    expect(priced.suggestion).toContain('建议');
  });
});

