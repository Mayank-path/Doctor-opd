import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PdfGeneratorService } from './services/pdf-generator.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PdfGeneratorService],
  exports: [PrescriptionsService, PdfGeneratorService],
})
export class PrescriptionsModule {}

