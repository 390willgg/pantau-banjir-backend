import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function buildCorsOriginValidator() {
  const allowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    try {
      const requestOrigin = new URL(origin);
      const isLocalProtocol =
        requestOrigin.protocol === 'http:' || requestOrigin.protocol === 'https:';
      const isLocalHost =
        requestOrigin.hostname === 'localhost' || requestOrigin.hostname === '127.0.0.1';

      if (isLocalProtocol && isLocalHost) {
        callback(null, true);
        return;
      }
    } catch {
      callback(new Error(`Invalid CORS origin: ${origin}`), false);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`), false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  const port = Number(process.env.PORT ?? 3000);

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    credentials: true,
    origin: buildCorsOriginValidator(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Pantau Banjir API')
    .setDescription('Backend API untuk flood monitoring, sensor ingestion, dan alerting.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  Logger.log(`Pantau Banjir backend running on port ${port}`, 'Bootstrap');
}

void bootstrap();
