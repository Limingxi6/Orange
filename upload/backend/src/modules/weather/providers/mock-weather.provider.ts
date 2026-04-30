import { Injectable } from '@nestjs/common';
import {
  WeatherCurrentResult,
  WeatherForecastDay,
  WeatherForecastResult,
  WeatherProvider,
  WeatherQueryInput,
} from './weather-provider.interface';

@Injectable()
export class MockWeatherProvider implements WeatherProvider {
  async getCurrent(input: WeatherQueryInput): Promise<WeatherCurrentResult> {
    const city = this.resolveCity(input);
    const base = this.seedByRegion(input);
    const now = new Date();

    return {
      city,
      temperature: 18 + (base % 10),
      weather: ['晴', '多云', '阴', '小雨'][base % 4],
      humidity: 55 + (base % 35),
      windSpeed: `${2 + (base % 4)}级`,
      updateTime: now.toISOString(),
    };
  }

  async getForecast(
    input: WeatherQueryInput,
    days: number,
  ): Promise<WeatherForecastResult> {
    const city = this.resolveCity(input);
    const base = this.seedByRegion(input);
    const list: WeatherForecastDay[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const minTemp = 15 + ((base + i) % 10);
      const maxTemp = minTemp + 5 + ((base + i) % 4);
      const humidity = 50 + ((base * 3 + i * 7) % 40);
      list.push({
        date: date.toISOString().slice(0, 10),
        weather: ['晴', '多云', '阴', '小雨', '中雨'][(base + i) % 5],
        minTemp,
        maxTemp,
        humidity,
      });
    }

    return {
      city,
      days: list,
    };
  }

  private resolveCity(input: WeatherQueryInput) {
    if (input.city?.trim()) return input.city.trim();
    if (input.regionCode?.trim()) return `地区${input.regionCode.trim()}`;
    return '宜城市';
  }

  private seedByRegion(input: WeatherQueryInput) {
    const text = (input.regionCode || input.city || 'default').trim();
    let seed = 0;
    for (const ch of text) {
      seed += ch.charCodeAt(0);
    }
    return seed || 42;
  }
}
