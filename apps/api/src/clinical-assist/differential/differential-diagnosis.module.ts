import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DifferentialDiagnosisController } from './differential-diagnosis.controller';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';
import { KnowledgePackResolverService } from './services/knowledge-pack-resolver.service';

@Module({
  imports: [PrismaModule],
  controllers: [DifferentialDiagnosisController],
  providers: [KnowledgePackResolverService, DifferentialDiagnosisService],
  exports: [DifferentialDiagnosisService, KnowledgePackResolverService],
})
export class DifferentialDiagnosisModule {}

