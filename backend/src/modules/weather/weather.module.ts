import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { MockWeatherProvider } from './providers/mock-weather.provider';
import { WEATHER_PROVIDER } from './providers/weather-provider.interface';
import { RealWeatherProvider } from './providers/real-weather.provider';

@Module({
  imports: [ConfigModule],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    MockWeatherProvider,
    RealWeatherProvider,
    {
      provide: WEATHER_PROVIDER,
      inject: [ConfigService, MockWeatherProvider, RealWeatherProvider],
      useFactory: (
        configService: ConfigService,
        mockProvider: MockWeatherProvider,
        realProvider: RealWeatherProvider,
      ) => {
        const mode = configService.get<string>('weather.provider', 'real').toLowerCase();
        return mode === 'real' ? realProvider : mockProvider;
      },
    },
  ],
  exports: [WeatherService, WEATHER_PROVIDER],
})
export class WeatherModule {}
