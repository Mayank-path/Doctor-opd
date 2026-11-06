import { loadEnvironment } from './config/env.loader';

// Ensure environment is initialized if AppModule is loaded directly
loadEnvironment();

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { ClinicalAssistModule } from './clinical-assist/clinical-assist.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
    ConsultationsModule,
    PrescriptionsModule,
    ClinicalAssistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
