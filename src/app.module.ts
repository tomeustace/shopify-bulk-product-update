import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, label, printf } = winston.format;

@Module({
  imports: [
    WinstonModule.forRoot({
      level: 'info',
      format: combine(
        timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({
          filename: 'combined.log',
          maxsize: 100000,
          maxFiles: 150,
        }),
      ],
    }),
  ],
  controllers: [AppController],
  providers: [ AppService ]
})
export class AppModule {}
