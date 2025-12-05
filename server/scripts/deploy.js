const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

async function deploy() {
  const prisma = new PrismaClient();

  try {
    // Check if _prisma_migrations table exists and has our baseline
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'
      ) as exists
    `;

    const migrationTableExists = result[0]?.exists;

    if (migrationTableExists) {
      // Check if baseline is already marked as applied
      const baseline = await prisma.$queryRaw`
        SELECT * FROM _prisma_migrations
        WHERE migration_name = '0_init'
      `;

      if (baseline.length === 0) {
        // Tables exist but baseline not recorded - mark it as applied
        console.log('Marking baseline migration 0_init as applied...');
        await prisma.$executeRaw`
          INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (
            gen_random_uuid()::text,
            'baseline',
            NOW(),
            '0_init',
            NULL,
            NULL,
            NOW(),
            1
          )
        `;
        console.log('Baseline migration marked as applied.');
      } else {
        console.log('Baseline migration already recorded.');
      }
    } else {
      // First time - create migrations table and mark baseline
      console.log('Creating _prisma_migrations table and marking baseline...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS _prisma_migrations (
          id VARCHAR(36) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          finished_at TIMESTAMPTZ,
          migration_name VARCHAR(255) NOT NULL,
          logs TEXT,
          rolled_back_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          applied_steps_count INTEGER NOT NULL DEFAULT 0
        )
      `;
      await prisma.$executeRaw`
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (
          gen_random_uuid()::text,
          'baseline',
          NOW(),
          '0_init',
          NULL,
          NULL,
          NOW(),
          1
        )
      `;
      console.log('Baseline migration recorded.');
    }

    await prisma.$disconnect();

    // Now run prisma migrate deploy for any future migrations
    console.log('Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  } catch (error) {
    console.error('Deploy error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deploy();
