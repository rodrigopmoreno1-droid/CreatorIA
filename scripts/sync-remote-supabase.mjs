#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

function runCommand(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} falhou com status ${result.status ?? 'desconhecido'}.`);
  }
}

async function createTemporaryLoginRole({ accessToken, projectRef }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/cli/login-role`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ read_only: false })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Nao foi possivel criar login temporario do Supabase: ${text}`);
  }

  const payload = JSON.parse(text);
  if (!payload?.password) {
    throw new Error('Supabase nao retornou senha temporaria para a CLI.');
  }

  return payload;
}

async function main() {
  const root = process.cwd();
  const envFile = path.join(root, '.env.local');
  const envFromFile = parseEnvFile(envFile);

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? envFromFile.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN nao encontrado.');
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF ?? readRequiredFile(path.join(root, 'supabase/.temp/project-ref'), 'Project ref');
  const loginRole = await createTemporaryLoginRole({ accessToken, projectRef });
  const databaseUrl = new URL(`postgresql://${encodeURIComponent(loginRole.role)}@db.${projectRef}.supabase.co:5432/postgres`);
  databaseUrl.password = loginRole.password;

  console.log(`Login temporario criado: ${loginRole.role} (TTL ${loginRole.ttl_seconds}s)`);
  console.log(`Conectando no projeto ${projectRef} para revisar e aplicar migrations...`);

  const cliEnv = {
    npm_config_cache: '/tmp/contentos-npm-cache'
  };

  runCommand('npx', ['supabase', 'migration', 'list', '--db-url', databaseUrl.toString(), '--yes'], cliEnv);
  runCommand('npx', ['supabase', 'db', 'push', '--db-url', databaseUrl.toString(), '--dry-run', '--yes'], cliEnv);
  runCommand('npx', ['supabase', 'db', 'push', '--db-url', databaseUrl.toString(), '--yes'], cliEnv);

  console.log(`Migrations sincronizadas com sucesso em ${projectRef}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
