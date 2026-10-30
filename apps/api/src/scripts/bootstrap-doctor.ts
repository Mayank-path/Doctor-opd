import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapService,
  BootstrapDoctorInput,
} from '../auth/bootstrap/bootstrap.service';
import {
  parseDatabaseTarget,
  validateDatabaseEnvironment,
} from '../auth/bootstrap/bootstrap-target.util';
import { PrismaService } from '../prisma/prisma.service';
import { promptHidden, promptText } from './bootstrap-admin';

export function validateDoctorBootstrapDatabase(
  databaseName: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Direct CLI bootstrap execution is disabled in production environment.',
    );
  }
  if (databaseName !== 'doctor_opd_dev') {
    throw new Error(
      `Bootstrap refused: Doctor bootstrap is strictly restricted to development database "doctor_opd_dev". Current target: "${databaseName}".`,
    );
  }
}

export async function runDoctorBootstrap(): Promise<void> {
  // 1. Identify and guard database target
  const target = parseDatabaseTarget(process.env.DATABASE_URL);
  console.log('\n--- DOCTOR-OPD DOCTOR BOOTSTRAP INITIALIZATION ---');
  console.log(`Database Host:   ${target.host}:${target.port}`);
  console.log(`Database Target: ${target.databaseName}`);
  console.log('--------------------------------------------------\n');

  // Mandatory Safety Requirement: Strictly refuse production and any database other than doctor_opd_dev
  validateDoctorBootstrapDatabase(target.databaseName, process.env);

  let email = process.env.BOOTSTRAP_DOCTOR_EMAIL;
  let password = process.env.BOOTSTRAP_DOCTOR_PASSWORD;
  let fullName = process.env.BOOTSTRAP_DOCTOR_NAME;
  let phone = process.env.BOOTSTRAP_DOCTOR_PHONE;
  let clinicId = process.env.BOOTSTRAP_DOCTOR_CLINIC_ID;

  const isInteractive = !email || !password || !fullName || !phone || !clinicId;

  const prisma = new PrismaClient() as unknown as PrismaService;
  const bootstrapService = new BootstrapService(prisma);

  try {
    if (isInteractive) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let confirmation = '';
      try {
        confirmation = await promptText(
          rl,
          `Type target database name "${target.databaseName}" to confirm execution: `,
        );

        validateDatabaseEnvironment(
          process.env,
          target.databaseName,
          true,
          confirmation,
        );

        // Fetch and display active clinics for operator verification
        const activeClinics = await (
          prisma as unknown as PrismaClient
        ).clinic.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        if (activeClinics.length === 0) {
          throw new Error(
            'Bootstrap failed: No active clinics found in database. Bootstrap a clinic administrator first.',
          );
        }

        if (!clinicId) {
          console.log('\nAvailable Active Clinics:');
          activeClinics.forEach((c, idx) => {
            console.log(`  [${idx + 1}] ${c.name} (${c.id})`);
          });

          const defaultHint =
            activeClinics.length === 1
              ? ` [default: 1 - ${activeClinics[0].name}]`
              : '';
          const selection = await promptText(
            rl,
            `\nSelect Clinic [enter number 1-${activeClinics.length} or clinic UUID]${defaultHint}: `,
          );

          const effectiveSelection =
            !selection && activeClinics.length === 1 ? '1' : selection;
          const index = parseInt(effectiveSelection, 10);
          if (!isNaN(index) && index >= 1 && index <= activeClinics.length) {
            clinicId = activeClinics[index - 1].id;
          } else {
            clinicId = effectiveSelection.trim();
          }
        }

        if (!email) {
          email = await promptText(rl, 'Enter Doctor Email: ');
        }
        if (!fullName) {
          fullName = await promptText(
            rl,
            'Enter Doctor Full Name (e.g. Dr. Jane Smith): ',
          );
        }
        if (!phone) {
          phone = await promptText(rl, 'Enter Doctor Phone Number: ');
        }
        if (!password) {
          password = await promptHidden(
            'Enter Doctor Password (input masked): ',
          );
        }
      } finally {
        rl.close();
      }
    } else {
      // Non-interactive mode: validate environment and require explicit confirmation env variable
      validateDatabaseEnvironment(process.env, target.databaseName, false);
    }

    const input: BootstrapDoctorInput = {
      email: email ? email.trim() : '',
      password: password ? password.trim() : '',
      fullName: fullName ? fullName.trim() : '',
      phone: phone ? phone.trim() : '',
      clinicId: clinicId ? clinicId.trim() : '',
    };

    const result = await bootstrapService.bootstrapDoctor(input);
    console.log('\n--- DOCTOR BOOTSTRAP COMPLETED SUCCESSFULLY ---');
    console.log(`Doctor User ID:  ${result.userId}`);
    console.log(`Clinic ID:       ${result.clinicId}`);
    console.log(`Membership ID:   ${result.membershipId}`);
    console.log(`Doctor Name:     ${result.fullName}`);
    console.log(`Email:           ${result.email}`);
    console.log(`Role:            ${result.role}`);
    console.log(`Status:          ${result.status}`);
    console.log('-----------------------------------------------\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[BOOTSTRAP ERROR] ${message}\n`);
    process.exit(1);
  } finally {
    await (prisma as unknown as PrismaClient).$disconnect();
  }
}

if (require.main === module) {
  runDoctorBootstrap().catch((err) => {
    console.error('[UNEXPECTED ERROR]', err);
    process.exit(1);
  });
}
