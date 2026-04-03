import { Injectable } from '@nestjs/common';
import { RiskLevel } from '@prisma/client';

export type RiskItem = {
  type: string;
  level: RiskLevel;
  title: string;
  reason: string;
  score: number;
};

export type RiskInput = {
  stage: string;
  weather: {
    condition?: string;
    temp?: number;
    humidity?: number;
    forecastData?: Array<Record<string, any>>;
  };
  recentDiseaseCount: number;
  recentHighDiseaseCount: number;
  latestDiseaseConfidence?: number;
  latestIrrigationAt?: Date | null;
  now: Date;
};

export type RiskAssessmentResult = {
  overallLevel: RiskLevel;
  overallScore: number;
  riskItems: RiskItem[];
  suggestions: string[];
};

@Injectable()
export class RiskEngineService {
  /**
   * 第一版规则引擎：
   * - 连续降雨 + 生长中期 -> 病害高风险
   * - 高温 + 缺少灌溉日志 -> 干旱风险
   * - 近期病害识别高置信 -> 病害扩散风险
   */
  assess(input: RiskInput): RiskAssessmentResult {
    const items: RiskItem[] = [];

    const stage = input.stage || '';
    const isGrowthStage = ['花期', '果实膨大期', '成熟期'].some((x) => stage.includes(x));

    const forecast = Array.isArray(input.weather.forecastData)
      ? input.weather.forecastData
      : [];
    const rainyDays = forecast.slice(0, 3).filter((d) => {
      const icon = String(d.icon ?? '').toLowerCase();
      const condition = String(d.condition ?? '').toLowerCase();
      return (
        icon.includes('rain') ||
        condition.includes('rain') ||
        condition.includes('雨')
      );
    }).length;

    // 规则1：连续降雨 + 生长中期 -> 病害风险偏高
    if (rainyDays >= 2 && isGrowthStage) {
      items.push({
        type: 'disease-spread',
        level: rainyDays >= 3 ? RiskLevel.high : RiskLevel.mid,
        title: '病害扩散风险',
        reason: `未来3天预计有${rainyDays}天降雨，且当前处于${stage}，湿度条件利于病害扩散。`,
        score: rainyDays >= 3 ? 40 : 28,
      });
    }

    // 规则2：高温 + 缺少灌溉日志 -> 干旱风险
    const temp = Number(input.weather.temp ?? 0);
    const daysWithoutIrrigation = input.latestIrrigationAt
      ? Math.floor(
          (input.now.getTime() - input.latestIrrigationAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 99;
    if (temp >= 32 && daysWithoutIrrigation >= 5) {
      items.push({
        type: 'drought',
        level: temp >= 35 ? RiskLevel.high : RiskLevel.mid,
        title: '干旱风险',
        reason: `当前温度约${temp}°C，且已${daysWithoutIrrigation}天无灌溉记录，存在水分胁迫风险。`,
        score: temp >= 35 ? 35 : 24,
      });
    }

    // 规则3：近期病害识别记录偏多
    if (input.recentDiseaseCount >= 2) {
      items.push({
        type: 'disease-history',
        level:
          input.recentHighDiseaseCount >= 1 ? RiskLevel.high : RiskLevel.mid,
        title: '病害历史风险',
        reason:
          input.recentHighDiseaseCount >= 1
            ? `近7天识别到${input.recentDiseaseCount}条病害记录，含高风险样本。`
            : `近7天识别到${input.recentDiseaseCount}条病害记录，需加强巡园。`,
        score: input.recentHighDiseaseCount >= 1 ? 30 : 18,
      });
    }

    // 无命中规则时给低风险基线
    if (items.length === 0) {
      items.push({
        type: 'baseline',
        level: RiskLevel.low,
        title: '基础风险',
        reason: '当前未触发明显高风险规则，建议按常规频率巡检。',
        score: 10,
      });
    }

    const overallScore = items.reduce((sum, x) => sum + x.score, 0);
    const overallLevel =
      overallScore >= 60
        ? RiskLevel.high
        : overallScore >= 30
        ? RiskLevel.mid
        : RiskLevel.low;

    const suggestions = this.buildSuggestions(items, overallLevel);

    return {
      overallLevel,
      overallScore,
      riskItems: items,
      suggestions,
    };
  }

  levelText(level: RiskLevel) {
    if (level === RiskLevel.high) return '高';
    if (level === RiskLevel.mid) return '中';
    return '低';
  }

  private buildSuggestions(items: RiskItem[], overall: RiskLevel) {
    const set = new Set<string>();

    for (const item of items) {
      if (item.type === 'disease-spread' || item.type === 'disease-history') {
        set.add('加强巡园，重点检查病斑区域');
        set.add('对可疑区域进行复拍复核，必要时进行针对性喷药');
      }
      if (item.type === 'drought') {
        set.add('尽快安排灌溉，优先保障树体水分供应');
        set.add('高温时段避免施肥和强修剪作业');
      }
    }

    if (overall === RiskLevel.high) {
      set.add('建议48小时内完成一次全园风险复评');
    } else if (overall === RiskLevel.mid) {
      set.add('建议3天内复查关键风险点');
    } else {
      set.add('保持常规巡检节奏，持续观察天气变化');
    }

    return Array.from(set);
  }
}

