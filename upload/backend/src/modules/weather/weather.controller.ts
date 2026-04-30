import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { QueryWeatherDto } from './dto/query-weather.dto';
import { QueryForecastDto } from './dto/query-forecast.dto';

@ApiTags('weather')
@ApiBearerAuth('JWT')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @ApiOperation({ summary: '获取当前天气' })
  @ApiQuery({ name: 'regionCode', required: false, example: '420684' })
  @ApiQuery({ name: 'region_code', required: false, example: '420684' })
  @ApiQuery({ name: 'city', required: false, example: '宜城市' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          city: '宜城市',
          temperature: 26,
          weather: '晴',
          humidity: 65,
          windSpeed: '2级',
          updateTime: '2026-03-23T09:30:00.000Z',
        },
      },
    },
  })
  getCurrent(@Query() query: QueryWeatherDto) {
    return this.weatherService.getCurrent(query);
  }

  @Get('forecast')
  @ApiOperation({ summary: '获取未来 15 天天气预报' })
  @ApiQuery({ name: 'regionCode', required: false, example: '420684' })
  @ApiQuery({ name: 'region_code', required: false, example: '420684' })
  @ApiQuery({ name: 'city', required: false, example: '宜城市' })
  @ApiQuery({ name: 'days', required: false, example: 15 })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          city: '宜城市',
          days: [
            {
              date: '2026-03-23',
              weather: '晴',
              minTemp: 19,
              maxTemp: 27,
              humidity: 60,
            },
          ],
        },
      },
    },
  })
  getForecast(@Query() query: QueryForecastDto) {
    return this.weatherService.getForecast(query);
  }
}
