import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClinicalNormalizationModule } from '../normalization/clinical-normalization.module';
import { ClinicalExtractionController } from './clinical-extraction.controller';
import { ClinicalExtractionService } from './clinical-extraction.service';

@Module({
  imports: [PrismaModule, ClinicalNormalizationModule],
  controllers: [ClinicalExtractionController],
  providers: [ClinicalExtractionService],
  exports: [ClinicalExtractionService],
})
export class ClinicalExtractionModule {}

