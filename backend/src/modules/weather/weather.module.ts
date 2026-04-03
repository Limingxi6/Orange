import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { MockWeatherProvider } from './providers/mock-weather.provider';
import { WEATHER_PROVIDER } from './providers/weather-provider.interface';

@Module({
  controllers: [WeatherController],
  providers: [
    WeatherService,
    MockWeatherProvider,
    {
      provide: WEATHER_PROVIDER,
      useExisting: MockWeatherProvider,
    },
  ],
  exports: [WeatherService, WEATHER_PROVIDER],
})
export class WeatherModule {}
