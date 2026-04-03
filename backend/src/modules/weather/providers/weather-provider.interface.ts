export type WeatherCurrentResult = {
  city: string;
  temperature: number;
  weather: string;
  humidity: number;
  windSpeed: string;
  updateTime: string;
};

export type WeatherForecastDay = {
  date: string;
  weather: string;
  minTemp: number;
  maxTemp: number;
  humidity: number;
};

export type WeatherForecastResult = {
  city: string;
  days: WeatherForecastDay[];
};

export type WeatherQueryInput = {
  regionCode?: string;
  city?: string;
};

export interface WeatherProvider {
  getCurrent(input: WeatherQueryInput): Promise<WeatherCurrentResult>;
  getForecast(input: WeatherQueryInput, days: number): Promise<WeatherForecastResult>;
}

export const WEATHER_PROVIDER = 'WEATHER_PROVIDER';
