import { PrismaClient } from '@prisma/client';
import { GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED } from './general-medicine';
import { KnowledgePackBootstrapper } from './knowledge-pack-bootstrapper';

/**
 * Dedicated Bootstrap CLI Entry Point for Clinical Decision Support Knowledge Packs.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register prisma/seeds/bootstrap-knowledge-pack.ts [--dry-run]
 *
 * Safety Default:
 *   Defaults to dry-run mode unless explicitly executed with --execute AND affirmative confirmation.
 */
async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute || args.includes('--dry-run');

  console.log('========================================================================');
  console.log('CLINICAL KNOWLEDGE PACK BOOTSTRAPPER');
  console.log('Target: GENERAL_MEDICINE v1.0.0-draft');
  console.log(`Execution Mode: ${isDryRun ? 'DRY RUN (Validation & Checksum Only)' : 'LIVE SEED EXECUTION'}`);
  console.log('========================================================================\n');

  const prisma = new PrismaClient();
  const dbRes = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
    'SELECT current_database();',
  );
  const dbName = dbRes[0]?.current_database;
  console.log(`Connected Database:   ${dbName}\n`);

  const bootstrapper = new KnowledgePackBootstrapper(prisma);

  try {
    const result = await bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED, {
      dryRun: isDryRun,
    });

    console.log('Bootstrap Validation Summary:');
    console.log(`- Domain:             ${result.domain}`);
    console.log(`- Version:            ${result.version} (${result.releaseStatus})`);
    console.log(`- SHA-256 Checksum:   ${result.checksumSha256}`);
    console.log(`- Action:             ${result.action}`);
    console.log(`- Conditions Seeded:  ${result.conditionsCount}`);
    console.log(`- Rules Seeded:       ${result.rulesCount}`);
    console.log(`- Red Flags Seeded:   ${result.redFlagsCount}`);
    console.log(`- Sources Seeded:     ${result.sourcesCount}`);
    console.log(`- Mappings Seeded:    ${result.mappingsCount}`);

    if (isDryRun) {
      console.log('\n[DRY RUN COMPLETE] Zero database records were modified.');
    } else {
      console.log('\n[LIVE SEED COMPLETE] Knowledge pack successfully seeded in DRAFT status.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nBootstrap Failure:', err.message);
    process.exit(1);
  });
}

