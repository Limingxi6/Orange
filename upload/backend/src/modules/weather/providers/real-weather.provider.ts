import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WeatherCurrentResult,
  WeatherForecastDay,
  WeatherForecastResult,
  WeatherProvider,
  WeatherQueryInput,
} from './weather-provider.interface';

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_min?: number[];
  temperature_2m_max?: number[];
  relative_humidity_2m_mean?: number[];
};

type OpenMeteoForecastResponse = {
  current?: OpenMeteoCurrent;
  daily?: OpenMeteoDaily;
};

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

type Coordinates = {
  latitude: number;
  longitude: number;
  city: string;
};

@Injectable()
export class RealWeatherProvider implements WeatherProvider {
  private readonly logger = new Logger(RealWeatherProvider.name);
  private readonly forecastApiBaseUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly geocodingApiBaseUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly defaultLatitude = 30.5928;
  private readonly defaultLongitude = 114.3055;
  private readonly defaultCityName = '武汉市';
  private readonly requestApiKey: string;
  private readonly defaultLocationId: string;

  constructor(private readonly configService: ConfigService) {
    this.requestApiKey = this.configService.get<string>('weather.apiKey', '').trim();
    this.defaultLocationId = this.configService
      .get<string>('weather.defaultLocationId', `${this.defaultLatitude},${this.defaultLongitude}`)
      .trim();
  }

  async getCurrent(input: WeatherQueryInput): Promise<WeatherCurrentResult> {
    const coordinates = await this.resolveCoordinates(input);
    const url = this.buildForecastUrl(coordinates.latitude, coordinates.longitude, 1);
    const data = await this.fetchForecast(url, 'current');
    const current = data.current;

    if (!current) {
      throw new Error('Open-Meteo current payload is empty');
    }

    return {
      city: coordinates.city,
      temperature: Number(current.temperature_2m ?? 0),
      weather: this.toWeatherText(current.weather_code),
      humidity: Number(current.relative_humidity_2m ?? 0),
      windSpeed: `${Math.round(Number(current.wind_speed_10m ?? 0))}km/h`,
      updateTime: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    };
  }

  async getForecast(input: WeatherQueryInput, days: number): Promise<WeatherForecastResult> {
    const coordinates = await this.resolveCoordinates(input);
    const normalizedDays = this.normalizeForecastDays(days);
    const url = this.buildForecastUrl(coordinates.latitude, coordinates.longitude, normalizedDays);
    const data = await this.fetchForecast(url, 'forecast');
    const daily = data.daily;

    if (!daily?.time?.length) {
      throw new Error('Open-Meteo forecast payload is empty');
    }

    const forecastDays: WeatherForecastDay[] = [];
    const size = Math.min(
      normalizedDays,
      daily.time.length,
      daily.weather_code?.length ?? 0,
      daily.temperature_2m_min?.length ?? 0,
      daily.temperature_2m_max?.length ?? 0,
      daily.relative_humidity_2m_mean?.length ?? 0,
    );

    for (let i = 0; i < size; i += 1) {
      forecastDays.push({
        date: String(daily.time[i] || ''),
        weather: this.toWeatherText(daily.weather_code?.[i]),
        minTemp: Number(daily.temperature_2m_min?.[i] ?? 0),
        maxTemp: Number(daily.temperature_2m_max?.[i] ?? 0),
        humidity: Number(daily.relative_humidity_2m_mean?.[i] ?? 0),
      });
    }

    return {
      city: coordinates.city,
      days: forecastDays,
    };
  }

  private buildForecastUrl(latitude: number, longitude: number, days: number): string {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      daily:
        'weather_code,temperature_2m_min,temperature_2m_max,relative_humidity_2m_mean',
      forecast_days: String(days),
      timezone: 'Asia/Shanghai',
    });

    return `${this.forecastApiBaseUrl}?${params.toString()}`;
  }

  private async fetchForecast(url: string, scene: 'current' | 'forecast') {
    const response = await fetch(url, { headers: this.buildRequestHeaders() });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Open-Meteo ${scene} failed status=${response.status} body=${body || '<empty>'}`);
      throw new Error(`Open-Meteo ${scene} request failed: ${response.status}`);
    }

    return (await response.json()) as OpenMeteoForecastResponse;
  }

  private async resolveCoordinates(input: WeatherQueryInput): Promise<Coordinates> {
    const fromRegionCoordinates = this.tryParseCoordinates(input.regionCode);
    if (fromRegionCoordinates) {
      return {
        ...fromRegionCoordinates,
        city: input.city?.trim() || `地区${input.regionCode?.trim() || '默认'}`,
      };
    }

    if (input.city?.trim()) {
      const fromCity = await this.geocodeByCity(input.city.trim());
      if (fromCity) {
        return {
          ...fromCity,
          city: input.city.trim(),
        };
      }
    }

    if (input.regionCode?.trim()) {
      const fromRegionAsCity = await this.geocodeByCity(input.regionCode.trim());
      if (fromRegionAsCity) {
        return {
          ...fromRegionAsCity,
          city: input.city?.trim() || fromRegionAsCity.city,
        };
      }
    }

    const fromEnvCoordinates = this.tryParseCoordinates(this.defaultLocationId);
    if (fromEnvCoordinates) {
      return {
        ...fromEnvCoordinates,
        city: input.city?.trim() || this.defaultCityName,
      };
    }

    return {
      latitude: this.defaultLatitude,
      longitude: this.defaultLongitude,
      city: input.city?.trim() || this.defaultCityName,
    };
  }

  private async geocodeByCity(city: string): Promise<Coordinates | null> {
    const params = new URLSearchParams({
      name: city,
      count: '1',
      language: 'zh',
      format: 'json',
    });
    const url = `${this.geocodingApiBaseUrl}?${params.toString()}`;

    const response = await fetch(url, { headers: this.buildRequestHeaders() });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Open-Meteo geocoding failed status=${response.status} body=${body || '<empty>'}`);
      return null;
    }

    const data = (await response.json()) as OpenMeteoGeocodingResponse;
    const first = data.results?.[0];
    if (
      !first ||
      typeof first.latitude !== 'number' ||
      typeof first.longitude !== 'number'
    ) {
      return null;
    }

    return {
      latitude: first.latitude,
      longitude: first.longitude,
      city: first.name?.trim() || city,
    };
  }

  private tryParseCoordinates(value?: string): Omit<Coordinates, 'city'> | null {
    if (!value) return null;
    const text = value.trim();
    const matched = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!matched) return null;

    const latitude = Number(matched[1]);
    const longitude = Number(matched[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90) return null;
    if (longitude < -180 || longitude > 180) return null;

    return { latitude, longitude };
  }

  private normalizeForecastDays(days: number): number {
    if (!Number.isFinite(days) || days <= 0) return 1;
    return Math.min(Math.floor(days), 15);
  }

  private buildRequestHeaders(): HeadersInit | undefined {
    if (!this.requestApiKey) {
      return undefined;
    }
    return { 'X-Api-Key': this.requestApiKey };
  }

  private toWeatherText(code?: number): string {
    switch (code) {
      case 0:
        return '晴';
      case 1:
        return '晴间多云';
      case 2:
        return '多云';
      case 3:
        return '阴';
      case 45:
      case 48:
        return '雾';
      case 51:
      case 53:
      case 55:
        return '毛毛雨';
      case 56:
      case 57:
        return '冻毛毛雨';
      case 61:
        return '小雨';
      case 63:
        return '中雨';
      case 65:
        return '大雨';
      case 66:
      case 67:
        return '冻雨';
      case 71:
        return '小雪';
      case 73:
        return '中雪';
      case 75:
        return '大雪';
      case 77:
        return '雪粒';
      case 80:
      case 81:
      case 82:
        return '阵雨';
      case 85:
      case 86:
        return '阵雪';
      case 95:
        return '雷暴';
      case 96:
      case 99:
        return '强雷暴';
      default:
        return '未知';
    }
  }
}
