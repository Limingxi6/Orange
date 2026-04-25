import * as crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  DiseaseSeverity,
  DiseaseStatus,
  ProductStatus,
  RiskLevel,
  UserRole,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// 显式加载项目根目录 .env，避免从不同工作目录执行 seed 时丢失 DATABASE_URL。
loadEnv({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

/**
 * 轻量级密码加密（用于 seed 测试）
 * 返回格式：salt$iterations$hash
 *
 * 注意：正式鉴权模块建议统一使用 bcrypt 等成熟实现。
 */
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, iterations, 32, 'sha256')
    .toString('hex');
  return `${salt}$${iterations}$${derivedKey}`;
}

function isoDateOnly(dateStr: string) {
  // YYYY-MM-DD -> Date(UTC midnight)，避免时区导致日期回传漂移
  const [y, m, d] = dateStr.split('-').map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function isoDateTime(ymd: string, h = 10, min = 0) {
  // YYYY-MM-DDTHH:mm 形式，但这里用 UTC 组装更稳定
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d, h, min, 0));
}

async function main() {
  const phone = '13800000000';
  const rawPassword = '123456';

  // 1) 清库：按外键依赖顺序删除
  await prisma.traceRecord.deleteMany();
  await prisma.fruitGradeRecord.deleteMany();
  await prisma.weatherCache.deleteMany();
  await prisma.product.deleteMany();
  await prisma.riskRecord.deleteMany();
  await prisma.diseaseRecord.deleteMany();
  await prisma.farmingLog.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.user.deleteMany();

  // 2) 创建测试用户（passwordHash 已加密）
  const passwordHash = hashPassword(rawPassword);
  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      nickname: '测试用户',
      avatarUrl: '',
      role: UserRole.farmer,
      status: UserStatus.active,
    },
  });

  // 3) 创建 3 条测试批次
  const batchSeed = [
    {
      batchNo: '2026春-纽荷尔脐橙A区',
      orchardName: '东区3号地',
      variety: '纽荷尔脐橙',
      area: '5亩',
      treeCount: 250,
      plantingDate: '2026-01-15',
      expectedHarvestDate: '2026-05-20',
      stage: '果实膨大期',
      status: '种植中',
      remark: 'MVP 种植测试数据 A',
    },
    {
      batchNo: '2026春-纽荷尔脐橙B区',
      orchardName: '西区1号地',
      variety: '纽荷尔脐橙',
      area: '3.2亩',
      treeCount: 160,
      plantingDate: '2026-02-20',
      expectedHarvestDate: '2026-06-10',
      stage: '花期',
      status: '种植中',
      remark: 'MVP 种植测试数据 B',
    },
    {
      batchNo: '2025秋-纽荷尔脐橙C区',
      orchardName: '南区2号地',
      variety: '纽荷尔脐橙',
      area: '4亩',
      treeCount: 210,
      plantingDate: '2025-09-01',
      expectedHarvestDate: '2026-01-15',
      stage: '已采收',
      status: '已采收',
      remark: 'MVP 种植测试数据 C',
    },
  ];

  const batches: Awaited<ReturnType<typeof prisma.batch.create>>[] = [];
  for (const b of batchSeed) {
    const created = await prisma.batch.create({
      data: {
        batchNo: b.batchNo,
        orchardName: b.orchardName,
        variety: b.variety,
        area: b.area,
        treeCount: b.treeCount,
        plantingDate: isoDateOnly(b.plantingDate),
        expectedHarvestDate: b.expectedHarvestDate
          ? isoDateOnly(b.expectedHarvestDate)
          : null,
        stage: b.stage,
        status: b.status,
        managerId: user.id,
        remark: b.remark,
      },
    });
    batches.push(created);
  }

  // 4) 每个批次创建若干农事日志
  const logTypeSeed = [
    '识别',
    '浇水',
    '施肥',
    '喷药',
    '修剪',
    '采摘',
    '分级',
    '销售',
  ];

  const imageSeeds = [
    'https://example.com/images/orange_1.jpg',
    'https://example.com/images/orange_2.jpg',
    'https://example.com/images/orange_3.jpg',
  ];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const baseDate = batch.plantingDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const logs: Prisma.FarmingLogCreateManyInput[] = [
      {
        batchId: batch.id,
        type: logTypeSeed[(i * 3) % logTypeSeed.length],
        title: '叶片检查',
        content: `批次 ${batch.batchNo}：完成基础巡检与记录。`,
        operatorId: user.id,
        operationDate: isoDateTime(baseDate, 9, 30),
        images: ['https://example.com/images/orange_1.jpg'],
        detail: { severity: 'mid', notes: 'seed log' } as any,
      },
      {
        batchId: batch.id,
        type: logTypeSeed[(i * 3 + 1) % logTypeSeed.length],
        title: '灌溉施作',
        content: `批次 ${batch.batchNo}：按计划浇水/施肥一次。`,
        operatorId: user.id,
        operationDate: isoDateTime(baseDate, 14, 10),
        images: ['https://example.com/images/orange_2.jpg'],
        detail: { humidity: 72, seed: true } as any,
      },
      {
        batchId: batch.id,
        type: logTypeSeed[(i * 3 + 2) % logTypeSeed.length],
        title: '病害预警记录',
        content: `批次 ${batch.batchNo}：对病害风险点进行记录与处理。`,
        operatorId: user.id,
        operationDate: isoDateTime(baseDate, 18, 5),
        images: ['https://example.com/images/orange_3.jpg'],
        detail: { suggestedAction: 'spray' } as any,
      },
    ];

    // createMany 不返回 ID，这里使用 createMany 即可
    await prisma.farmingLog.createMany({
      data: logs,
    });
  }

  // 5) 创建若干病害识别记录
  for (const batch of batches) {
    const diseaseRecords: Prisma.DiseaseRecordCreateManyInput[] = [
      {
        batchId: batch.id,
        imageUrl: 'https://example.com/images/disease_1.jpg',
        diseaseName: '疑似柑橘溃疡病',
        confidence: 0.82,
        severity: DiseaseSeverity.mid,
        suggestion: '建议人工复核并进行针对性防治。',
        rawResult: {
          model: 'mvp-disease',
          bbox: [0.12, 0.22, 0.48, 0.55],
          extra: { seed: true },
        },
        status: DiseaseStatus.normal,
        createdBy: user.id,
      },
      {
        batchId: batch.id,
        imageUrl: 'https://example.com/images/disease_2.jpg',
        diseaseName: '疑似炭疽病',
        confidence: 0.63,
        severity: DiseaseSeverity.low,
        suggestion: '建议观察后续变化，必要时喷药。',
        rawResult: {
          model: 'mvp-disease',
          bbox: [0.2, 0.1, 0.4, 0.35],
        },
        status: DiseaseStatus.review,
        createdBy: user.id,
      },
    ];

    await prisma.diseaseRecord.createMany({
      data: diseaseRecords,
    });
  }

  // 6) 创建若干产品记录（每批次至少 1 个产品）
  const productIds: number[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const product = await prisma.product.create({
      data: {
        batchId: batch.id,
        productName: `${batch.batchNo} - 一级果`,
        grade: '一级果',
        weight: 10 + i * 5,
        unit: '斤',
        packageType: i % 2 === 0 ? '简装' : '礼盒',
        price: i % 2 === 0 ? '6.8 ~ 8.2 元/斤' : '7.2 ~ 9.0 元/斤',
        qrCodeUrl: `https://example.com/qrcode/${batch.batchNo.replace(
          /\\s+/g,
          '_',
        )}.png`,
        status: ProductStatus.listed,
      },
    });
    productIds.push(product.id);
  }

  // 7) 创建风险记录（每批次 1 条）
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const levelCycle = [RiskLevel.low, RiskLevel.mid, RiskLevel.high] as const;
    const riskLevel = levelCycle[i % levelCycle.length];
    const levelTextMap: Record<RiskLevel, string> = {
      [RiskLevel.low]: '低风险',
      [RiskLevel.mid]: '中风险',
      [RiskLevel.high]: '高风险',
    };

    await prisma.riskRecord.create({
      data: {
        batchId: batch.id,
        riskType: 'disease-weather-composite',
        riskLevel,
        levelText: levelTextMap[riskLevel],
        summary: `批次 ${batch.batchNo} 当前风险等级：${levelTextMap[riskLevel]}`,
        suggestion:
          riskLevel === RiskLevel.high
            ? '建议立即人工复核并执行针对性处置。'
            : riskLevel === RiskLevel.mid
              ? '建议加强巡检频次并关注病斑扩散。'
              : '建议保持常规巡检与记录。',
        sourceData: {
          weatherScore: 35 + i * 8,
          diseaseScore: 25 + i * 10,
          operationGapDays: 3 + i,
          seed: true,
        },
      },
    });
  }

  // 8) 创建果实分级记录（每批次 1 条）
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const colorScore = 82 - i * 4;
    const defectRatio = 0.03 + i * 0.02;
    const sizeScore = 86 - i * 3;
    const maturityScore = 80 - i * 2;
    const gradeText = i === 0 ? 'A' : i === 1 ? 'B' : 'C';
    const gradeCode = gradeText;
    const retailMinPrice = 6.5 - i * 0.5;
    const retailMaxPrice = 8.5 - i * 0.5;
    const wholesaleMinPrice = 4.8 - i * 0.4;
    const wholesaleMaxPrice = 6.2 - i * 0.4;
    const finalPrice = Number(((retailMinPrice + retailMaxPrice) / 2).toFixed(2));

    await prisma.fruitGradeRecord.create({
      data: {
        requestId: `seed-grade-${batch.id}`,
        batchId: batch.id,
        imageUrl: imageSeeds[i % imageSeeds.length],
        channel: i % 2 === 0 ? 'retail' : 'wholesale',
        packageType: i % 2 === 0 ? 'box' : 'bulk',
        region: '湖北-宜昌',
        diameter: 72 - i * 3,
        brix: 11.8 - i * 0.6,
        weight: 220 - i * 15,
        defectLevel: defectRatio > 0.06 ? 'mid' : 'low',
        colorScore,
        defectRatio,
        sizeScore,
        maturityScore,
        detectedDiameter: 71 - i * 3,
        confidence: 0.9 - i * 0.08,
        gradeCode,
        gradeText,
        retailMinPrice,
        retailMaxPrice,
        wholesaleMinPrice,
        wholesaleMaxPrice,
        finalPrice,
        engineSource: 'seed-rule-engine',
        decisionSource: 'seed-rule-engine',
        modelVersion: 'seed-v1',
        reason: `批次 ${batch.batchNo} 综合评分完成分级，等级 ${gradeText}。`,
        riskWarning: defectRatio > 0.06 ? '瑕疵比例偏高，建议人工复核。' : '风险可控。',
        factors: {
          colorScore,
          defectRatio,
          sizeScore,
          maturityScore,
        },
        rawResult: {
          requestSource: 'seed',
          seed: true,
        },
      },
    });
  }

  // 9) 创建至少 1 条溯源记录（这里每个产品都生成 1 条）
  for (let i = 0; i < productIds.length; i++) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productIds[i] },
      include: { batch: true },
    });

    await prisma.traceRecord.create({
      data: {
        productId: product.id,
        traceCode: `TRACE-${product.id}-${Date.now()}`,
        batchSnapshot: {
          batchNo: product.batch.batchNo,
          orchardName: product.batch.orchardName,
          variety: product.batch.variety,
          stage: product.batch.stage,
          status: product.batch.status,
        },
        logsSnapshot: {
          note: 'seed snapshot',
          // MVP：这里直接给结构，不要求与前端完全一致
          count: 3,
        },
        inspectionsSnapshot: {
          note: 'seed inspections',
          diseaseCount: 2,
        },
        chainHash: crypto
          .createHash('sha256')
          .update(`${product.id}-${Date.now()}`)
          .digest('hex'),
        verified: true,
      },
    });
  }

  // 10) （可选）插入一条天气缓存，便于首页/风险预警页面查看
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const d = today.getUTCDate();
  const weatherDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

  await prisma.weatherCache.create({
    data: {
      regionCode: '420600',
      weatherDate,
      currentData: {
        location: '湖北省宜城市',
        condition: '多云',
        temp: 28,
        humidity: 72,
        wind: '2级',
      },
      forecastData: Array.from({ length: 15 }).map((_, idx) => {
        const dt = new Date(weatherDate.getTime() + idx * 86400000);
        const dateStr = dt.toISOString().slice(0, 10);
        const riskScore = 35 + idx * 2;
        return {
          date: dateStr,
          day: dt.toISOString().slice(5, 10),
          icon: idx % 2 === 0 ? 'cloud' : 'sun',
          tempMin: 20,
          tempMax: 30,
          humidity: 65,
          riskScore,
        };
      }),
    },
  });

  console.log(`[seed] Done. userId=${user.id}, batches=${batches.length}`);
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
