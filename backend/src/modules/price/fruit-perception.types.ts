export type PerceptionEngine = 'python-ai' | 'local-rule' | 'fallback-default';

export type FruitPerceptionResult = {
  colorScore: number;
  defectRatio: number;
  sizeScore: number;
  maturityScore: number;
  detectedDiameter?: number | null;
  confidence?: number | null;
  engine: PerceptionEngine;
  modelVersion?: string | null;
  rawResult?: Record<string, unknown> | null;
};

export type NormalizedAiFruitInput = {
  batchId?: number;
  imageUrl?: string;
  channel?: string;
  packageType?: string;
  region?: string;
  diameter?: number;
  brix?: number;
  weight?: number;
  defectLevel?: 'low' | 'mid' | 'high';
};

export type MergedFruitFeatures = {
  colorScore: number;
  defectRatio: number;
  sizeScore: number;
  maturityScore: number;
  detectedDiameter?: number | null;
  confidence?: number | null;
  diameter?: number;
  brix?: number;
  weight?: number;
  defectLevel?: 'low' | 'mid' | 'high';
};

