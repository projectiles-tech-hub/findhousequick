import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

// JSON has no 64-bit integers; money (bigint) is sent as strings.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

/**
 * Shared app setup, used by main.ts and by the API tests so both run the server the same way.
 * Every route is under /v1 so older app versions keep working when /v2 arrives.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const docs = new DocumentBuilder()
    .setTitle('FindHouseQuick API')
    .setDescription('API used by the FindHouseQuick apps. See docs/api for the full Release 1 design.')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, docs));
  return app;
}
