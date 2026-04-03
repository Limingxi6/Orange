import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryWeatherDto } from './dto/query-weather.dto';
import { QueryForecastDto } from './dto/query-forecast.dto';
import {
  WEATHER_PROVIDER,
  WeatherCurrentResult,
  WeatherForecastResult,
  WeatherProvider,
  WeatherQueryInput,
} from './providers/weather-provider.interface';

@Injectable()
export class WeatherService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEATHER_PROVIDER) private readonly provider: WeatherProvider,
  ) {}

  async getCurrent(query: QueryWeatherDto): Promise<WeatherCurrentResult> {
    const input = this.buildInput(query.regionCode, query.region_code, query.city);
    const cacheKey = this.buildCacheRegionCode(input);
    const weatherDate = this.todayDate();

    const cached = await this.prisma.weatherCache.findUnique({
      where: {
        regionCode_weatherDate: {
          regionCode: cacheKey,
          weatherDate,
        },
      },
      select: {
        currentData: true,
      },
    });

    if (cached?.currentData) {
      return cached.currentData as unknown as WeatherCurrentResult;
    }

    const current = await this.provider.getCurrent(input);
    await this.upsertCache(cacheKey, weatherDate, current, undefined);
    return current;
  }

  async getForecast(query: QueryForecastDto): Promise<WeatherForecastResult> {
    const days = query.days ?? 15;
    const input = this.buildInput(query.regionCode, query.region_code, query.city);
    const cacheKey = this.buildCacheRegionCode(input);
    const weatherDate = this.todayDate();

    const cached = await this.prisma.weatherCache.findUnique({
      where: {
        regionCode_weatherDate: {
          regionCode: cacheKey,
          weatherDate,
        },
      },
      select: {
        forecastData: true,
      },
    });

    if (cached?.forecastData && Array.isArray(cached.forecastData)) {
      return {
        city: input.city?.trim() || `地区${input.regionCode ?? '默认'}`,
        days: (cached.forecastData as unknown as WeatherForecastResult['days']).slice(
          0,
          days,
        ),
      };
    }

    const forecast = await this.provider.getForecast(input, 15);
    await this.upsertCache(cacheKey, weatherDate, undefined, forecast.days);
    return {
      city: forecast.city,
      days: forecast.days.slice(0, days),
    };
  }

  private buildInput(
    regionCode?: string,
    regionCodeSnake?: string,
    city?: string,
  ): WeatherQueryInput {
    return {
      regionCode: regionCode?.trim() || regionCodeSnake?.trim(),
      city: city?.trim(),
    };
  }

  private buildCacheRegionCode(input: WeatherQueryInput) {
    if (input.regionCode?.trim()) return input.regionCode.trim();
    if (input.city?.trim()) return `CITY:${input.city.trim()}`;
    return 'DEFAULT';
  }

  private todayDate() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private async upsertCache(
    regionCode: string,
    weatherDate: Date,
    current?: WeatherCurrentResult,
    forecastDays?: WeatherForecastResult['days'],
  ) {
    const existing = await this.prisma.weatherCache.findUnique({
      where: {
        regionCode_weatherDate: {
          regionCode,
          weatherDate,
        },
      },
      select: {
        id: true,
        currentData: true,
        forecastData: true,
      },
    });

    const currentData = (current ??
      (existing?.currentData as unknown as WeatherCurrentResult | undefined) ??
      {}) as Prisma.InputJsonValue;
    const forecastData = (forecastDays ??
      (existing?.forecastData as unknown as WeatherForecastResult['days'] | undefined) ??
      []) as Prisma.InputJsonValue;

    await this.prisma.weatherCache.upsert({
      where: {
        regionCode_weatherDate: {
          regionCode,
          weatherDate,
        },
      },
      update: {
        currentData,
        forecastData,
      },
      create: {
        regionCode,
        weatherDate,
        currentData,
        forecastData,
      },
    });
  }
}
