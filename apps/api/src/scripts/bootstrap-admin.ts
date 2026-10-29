import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapService,
  BootstrapAdminInput,
} from '../auth/bootstrap/bootstrap.service';
import {
  parseDatabaseTarget,
  validateDatabaseEnvironment,
} from '../auth/bootstrap/bootstrap-target.util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * TerminalManager handles safe TTY raw-mode transitions and guarantees
 * terminal state is restored on success, error, or SIGINT.
 */
export class TerminalManager {
  private stdin: NodeJS.ReadStream;
  private wasRaw = false;
  private isCleanedUp = false;
  private activeListener: ((char: Buffer) => void) | null = null;
  private sigintHandler: (() => void) | null = null;

  constructor(stdin: NodeJS.ReadStream = process.stdin) {
    this.stdin = stdin;
    if (this.stdin.isTTY) {
      this.wasRaw = Boolean(this.stdin.isRaw);
    }
  }

  public setRaw(): void {
    if (this.stdin.isTTY) {
      this.stdin.setRawMode(true);
    }
  }

  public registerDataListener(listener: (char: Buffer) => void): void {
    this.activeListener = listener;
    this.stdin.on('data', listener);
  }

  public registerSigint(onSigint: () => void): void {
    this.sigintHandler = () => {
      this.cleanup();
      process.stdout.write('\n[BOOTSTRAP CANCELLED BY USER]\n');
      onSigint();
    };
    process.once('SIGINT', this.sigintHandler);
  }

  public cleanup(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

    if (this.activeListener) {
      this.stdin.removeListener('data', this.activeListener);
      this.activeListener = null;
    }

    if (this.sigintHandler) {
      process.removeListener('SIGINT', this.sigintHandler);
      this.sigintHandler = null;
    }

    if (this.stdin.isTTY) {
      try {
        this.stdin.setRawMode(this.wasRaw);
      } catch {
        // Safe no-op if stdin was already closed
      }
    }
  }
}

export async function promptHidden(query: string): Promise<string> {
  const terminal = new TerminalManager();

  return new Promise((resolve) => {
    terminal.registerSigint(() => {
      process.exit(1);
    });

    process.stdout.write(query);
    terminal.setRaw();

    let input = '';
    const onData = (char: Buffer) => {
      const c = char.toString('utf8');
      if (c === '\n' || c === '\r' || c === '\u0004') {
        terminal.cleanup();
        process.stdout.write('\n');
        resolve(input);
      } else if (c === '\u0003') {
        // Ctrl+C
        terminal.cleanup();
        process.stdout.write('\n[BOOTSTRAP CANCELLED BY USER]\n');
        process.exit(1);
      } else if (c === '\b' || c === '\x7f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += c;
      }
    };

    terminal.registerDataListener(onData);
  });
}

export async function promptText(
  rl: readline.Interface,
  query: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function runBootstrap() {
  // 1. Identify and guard database target
  const target = parseDatabaseTarget(process.env.DATABASE_URL);
  console.log('\n--- DOCTOR-OPD BOOTSTRAP INITIALIZATION ---');
  console.log(`Database Host:   ${target.host}:${target.port}`);
  console.log(`Database Target: ${target.databaseName}`);
  console.log('-------------------------------------------\n');

  let email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  let fullName = process.env.BOOTSTRAP_ADMIN_NAME;
  let phone = process.env.BOOTSTRAP_ADMIN_PHONE;
  let clinicName = process.env.BOOTSTRAP_CLINIC_NAME;

  const isInteractive =
    !email || !password || !fullName || !phone || !clinicName;

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

      if (!email) {
        email = await promptText(rl, 'Enter Admin Email: ');
      }
      if (!fullName) {
        fullName = await promptText(rl, 'Enter Admin Full Name: ');
      }
      if (!phone) {
        phone = await promptText(rl, 'Enter Admin Phone Number: ');
      }
      if (!clinicName) {
        clinicName = await promptText(rl, 'Enter Clinic Name: ');
      }
      if (!password) {
        password = await promptHidden('Enter Admin Password (input masked): ');
      }
    } finally {
      rl.close();
    }
  } else {
    // Non-interactive mode: validate environment and require explicit confirmation env variable
    validateDatabaseEnvironment(process.env, target.databaseName, false);
  }

  const input: BootstrapAdminInput = {
    email: email ? email.trim() : '',
    password: password ? password.trim() : '',
    fullName: fullName ? fullName.trim() : '',
    phone: phone ? phone.trim() : '',
    clinicName: clinicName ? clinicName.trim() : '',
  };

  const prisma = new PrismaClient() as unknown as PrismaService;
  const bootstrapService = new BootstrapService(prisma);

  try {
    const result = await bootstrapService.bootstrapAdmin(input);
    console.log('\n--- BOOTSTRAP COMPLETED SUCCESSFULLY ---');
    console.log(`User ID:       ${result.userId}`);
    console.log(`Clinic ID:     ${result.clinicId}`);
    console.log(`Membership ID: ${result.membershipId}`);
    console.log(`Email:         ${result.email}`);
    console.log(`Role:          ${result.role}`);
    console.log(`Status:        ${result.status}`);
    console.log('----------------------------------------\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[BOOTSTRAP ERROR] ${message}\n`);
    process.exit(1);
  } finally {
    await (prisma as unknown as PrismaClient).$disconnect();
  }
}

if (require.main === module) {
  runBootstrap().catch((err) => {
    console.error('[UNEXPECTED ERROR]', err);
    process.exit(1);
  });
}
