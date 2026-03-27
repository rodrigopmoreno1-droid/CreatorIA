#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const entries = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1);
    entries[key] = value;
  }

  return entries;
}

function readRequiredFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} nao encontrado em ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8').trim();
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function collectMigrationFiles(root) {
  const migrationsDir = path.join(root, 'supabase/migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Diretorio de migrations nao encontrado em ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => /^(\d{4})_[a-z0-9_]+\.sql$/i.test(file))
    .sort()
    .map((file) => {
      const match = file.match(/^(\d{4})_(.+)\.sql$/i);
      if (!match) {
        return null;
      }

      return {
        version: match[1],
        name: match[2],
        filePath: path.join(migrationsDir, file),
        sql: fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim()
      };
    })
    .filter(Boolean);
}

async function runDatabaseQuery({ accessToken, projectRef, query, readOnly = false }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ query, read_only: readOnly })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao executar query no Supabase: ${text}`);
  }

  return text ? JSON.parse(text) : [];
}

async function loadAppliedMigrationVersions({ accessToken, projectRef }) {
  const rows = await runDatabaseQuery({
    accessToken,
    projectRef,
    readOnly: true,
    query: 'select version from supabase_migrations.schema_migrations order by version;'
  });

  return new Set(rows.map((row) => String(row.version)));
}

async function applyMigration({ accessToken, projectRef, migration }) {
  console.log(`Aplicando migration ${migration.version} (${migration.name})...`);

  await runDatabaseQuery({
    accessToken,
    projectRef,
    readOnly: false,
    query: migration.sql
  });

  await runDatabaseQuery({
    accessToken,
    projectRef,
    readOnly: false,
    query: `insert into supabase_migrations.schema_migrations (version, name, statements)
values (${escapeSqlLiteral(migration.version)}, ${escapeSqlLiteral(migration.name)}, ARRAY[${escapeSqlLiteral(migration.sql)}]::text[])
on conflict (version) do nothing;`
  });

  await runDatabaseQuery({
    accessToken,
    projectRef,
    readOnly: false,
    query: "select pg_notification_queue_usage(); notify pgrst, 'reload schema';"
  });
}

async function main() {
  const root = process.cwd();
  const envFile = path.join(root, '.env.local');
  const envFromFile = parseEnvFile(envFile);

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? envFromFile.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN nao encontrado.');
  }

  const projectRef =
    process.env.SUPABASE_PROJECT_REF ??
    readRequiredFile(path.join(root, 'supabase/.temp/project-ref'), 'Project ref');

  const migrations = collectMigrationFiles(root);
  const appliedVersions = await loadAppliedMigrationVersions({ accessToken, projectRef });
  const pendingMigrations = migrations.filter((migration) => !appliedVersions.has(migration.version));

  if (!pendingMigrations.length) {
    console.log(`Nenhuma migration pendente para ${projectRef}.`);
    return;
  }

  console.log(`Sincronizando ${pendingMigrations.length} migration(s) no projeto ${projectRef}...`);

  for (const migration of pendingMigrations) {
    await applyMigration({ accessToken, projectRef, migration });
  }

  console.log(`Migrations sincronizadas com sucesso em ${projectRef}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
