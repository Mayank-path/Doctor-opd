import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClinicalNormalizationController } from './clinical-normalization.controller';
import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';
import { ClinicalNormalizationService } from './clinical-normalization.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClinicalNormalizationController],
  providers: [ClinicalNormalizationService, ClinicalNormalizationRegistry],
  exports: [ClinicalNormalizationService, ClinicalNormalizationRegistry],
})
export class ClinicalNormalizationModule {}
