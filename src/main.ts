import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for React Native app
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Use Socket.IO adapter with custom path so it passes through /api proxy
  app.useWebSocketAdapter(new IoAdapter(app));

  // Set global prefix for REST API routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4001;
  await app.listen(port, '0.0.0.0', () => {
    console.log(`A.S.G. Backend running on port ${port}`);
  });
}

bootstrap();
