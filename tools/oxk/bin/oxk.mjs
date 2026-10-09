#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(KIT, 'package.json'), 'utf8'));
const PROFILES = ['react-vite', 'nextjs', 'spring-boot', 'fastapi'];
const MODES = ['task', 'greenfield', 'ui', 'overnight'];
const START = '<!-- oxk:start -->';
const END = '<!-- oxk:end -->';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
const json = value => JSON.stringify(value, null, 2) + '\n';

function help() {
  console.log(`oxk ${pkg.version} — workflow bootstrap (Node.js 20+)

  oxk init [--project PATH] [--profiles nextjs,spring-boot,fastapi] [--local-pi] [--dry-run]
  oxk task SLUG [--project PATH] [--mode task|greenfield|ui|overnight] [--ui] [--dry-run]
  oxk doctor [--project PATH] [--task SLUG] [--json]
  oxk check-kit

No arguments display help. Project defaults to cwd. No network calls, installs or shipping.
init preserves project context/tasks and preflights managed-file conflicts; it has no force flag.
--local-pi materializes prompts + skill; choose this OR a pi package installation.
doctor verifies files/context, not actual extension/model/CI availability.`);
}

function parse(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) return { command: 'help' };
  const command = args.shift();
  const allowed = {
    init: ['project', 'profiles', 'local-pi', 'dry-run'],
    task: ['project', 'mode', 'ui', 'dry-run'],
    doctor: ['project', 'task', 'json'],
    'check-kit': []
  }[command];
  if (!allowed) throw new Error(`Unknown command: ${command}`);
  const flags = {}, positional = [];
  const booleans = new Set(['local-pi', 'dry-run', 'ui', 'json']);
  while (args.length) {
    const arg = args.shift();
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (!allowed.includes(key)) throw new Error(`Unknown flag for ${command}: ${arg}`);
    if (key in flags) throw new Error(`Repeated flag: ${arg}`);
    if (booleans.has(key)) flags[key] = true;
    else {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      flags[key] = value;
    }
  }
  if (positional.length !== (command === 'task' ? 1 : 0)) throw new Error(`Unexpected or missing argument for ${command}`);
  return { command, flags, positional };
}

function projectRoot(value) {
  const requested = path.resolve(value || process.cwd());
  let existing = requested;
  const tail = [];
  while (!fs.existsSync(existing)) {
    tail.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve project: ${requested}`);
    existing = parent;
  }
  if (!fs.statSync(existing).isDirectory()) throw new Error(`Project/ancestor is not a directory: ${existing}`);
  const root = path.join(fs.realpathSync(existing), ...tail);
  if (root === fs.realpathSync(KIT)) throw new Error('Keep the oxk checkout separate from the application project.');
  return root;
}

function safeFile(root, relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error(`Unsafe managed path: ${relative}`);
  const full = path.resolve(root, relative);
  if (full === root || !full.startsWith(root + path.sep)) throw new Error(`Path leaves project: ${relative}`);
  let current = root;
  const parts = path.relative(root, full).split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in managed path: ${path.relative(root, current)}`);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`Expected directory: ${path.relative(root, current)}`);
  }
  return full;
}

function filesUnder(root) {
  const result = [];
  function walk(directory, prefix = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.posix.join(prefix, item.name);
      if (item.isSymbolicLink()) throw new Error(`Source symlink is unsupported: ${relative}`);
      if (item.isDirectory()) walk(path.join(directory, item.name), relative);
      else if (item.isFile()) result.push(relative);
    }
  }
  walk(root);
  return result;
}

function loadManifest(root, required = false) {
  const raw = read(safeFile(root, '.agent/oxk.json'));
  if (!raw) {
    if (required) throw new Error('Project is not bootstrapped. Run oxk init first.');
    return null;
  }
  const value = JSON.parse(raw);
  if (value.schemaVersion !== 1 || value.kit !== 'oxk' || typeof value.version !== 'string' ||
      !Array.isArray(value.profiles) || value.profiles.some(p => !PROFILES.includes(p)) ||
      typeof value.localPi !== 'boolean' || typeof value.managed !== 'object' || value.managed === null || Array.isArray(value.managed) ||
      !/^[a-f0-9]{64}$/.test(value.agentsBlockHash)) throw new Error('Invalid or unsupported .agent/oxk.json');
  for (const [file, sha] of Object.entries(value.managed)) {
    if (!/^[a-f0-9]{64}$/.test(sha) || !['.agent/workflow/', '.pi/prompts/', '.agents/skills/oxk/'].some(prefix => file.startsWith(prefix))) {
      throw new Error(`Invalid managed entry: ${file}`);
    }
    safeFile(root, file);
  }
  return value;
}

function agentsParts(content) {
  if (!content.includes(START) && !content.includes(END)) return null;
  if (content.split(START).length !== 2 || content.split(END).length !== 2) throw new Error('AGENTS.md has ambiguous oxk markers.');
  const start = content.indexOf(START), endIndex = content.indexOf(END), end = endIndex + END.length;
  if (endIndex < start) throw new Error('AGENTS.md has reversed oxk markers.');
  return { prefix: content.slice(0, start), block: content.slice(start, end), suffix: content.slice(end) };
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.oxk-${process.pid}-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, content, { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function git(root, ...args) {
  // File-backed capture also works in hosts that restrict subprocess pipe syscalls.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oxk-git-'));
  const output = path.join(directory, 'stdout');
  const fd = fs.openSync(output, 'w');
  try {
    execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', fd, 'ignore'], timeout: 10000 });
    return fs.readFileSync(output, 'utf8').trim();
  } catch { return null; }
  finally { fs.closeSync(fd); fs.rmSync(directory, { recursive: true, force: true }); }
}

function template(file, values) {
  return fs.readFileSync(path.join(KIT, 'templates', file), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown template token: ${key}`);
    return String(values[key]);
  });
}

function init(root, flags) {
  const previous = loadManifest(root);
  const profiles = flags.profiles === undefined ? previous?.profiles || [] : [...new Set(flags.profiles.split(','))];
  if (profiles.some(p => !PROFILES.includes(p))) throw new Error(`Profiles must be selected from: ${PROFILES.join(', ')}`);
  const localPi = Boolean(flags['local-pi'] || previous?.localPi);
  const sources = {};
  const referenceRoot = path.join(KIT, 'skills/oxk/references');
  for (const file of filesUnder(referenceRoot)) sources[`.agent/workflow/${file}`] = fs.readFileSync(path.join(referenceRoot, file), 'utf8');
  if (localPi) {
    for (const file of filesUnder(path.join(KIT, 'prompts'))) sources[`.pi/prompts/${file}`] = fs.readFileSync(path.join(KIT, 'prompts', file), 'utf8');
    sources['.agents/skills/oxk/SKILL.md'] = fs.readFileSync(path.join(KIT, 'skills/oxk/SKILL.md'), 'utf8');
    sources['.agents/skills/oxk/agents/openai.yaml'] = fs.readFileSync(path.join(KIT, 'skills/oxk/agents/openai.yaml'), 'utf8');
    for (const file of filesUnder(referenceRoot)) sources[`.agents/skills/oxk/references/${file}`] = fs.readFileSync(path.join(referenceRoot, file), 'utf8');
  }
  const plan = [], conflicts = [], managed = { ...previous?.managed };
  function enqueue(relative, content) {
    const file = safeFile(root, relative);
    const current = read(file);
    if (current !== content) plan.push({ path: relative, action: current === null ? 'create' : 'update', content });
    return current;
  }
  for (const [relative, content] of Object.entries(sources)) {
    const current = read(safeFile(root, relative));
    if (current !== null && current !== content && previous?.managed[relative] !== hash(current)) conflicts.push(relative);
    else enqueue(relative, content);
    managed[relative] = hash(content);
  }
  const block = fs.readFileSync(path.join(KIT, 'templates/project/AGENTS.block.md'), 'utf8').trimEnd();
  const agentsFile = safeFile(root, 'AGENTS.md');
  const currentAgents = read(agentsFile), parts = agentsParts(currentAgents || '');
  if (parts) {
    if (parts.block !== block && previous?.agentsBlockHash !== hash(parts.block)) conflicts.push('AGENTS.md (oxk block)');
    else enqueue('AGENTS.md', parts.prefix + block + parts.suffix);
  } else if (previous && currentAgents !== null) conflicts.push('AGENTS.md (oxk block removed)');
  else enqueue('AGENTS.md', (currentAgents ? currentAgents + (currentAgents.endsWith('\n') ? '\n' : '\n\n') : '') + block + '\n');

  const projectContext = safeFile(root, '.agent/PROJECT.md');
  if (read(projectContext) === null) enqueue('.agent/PROJECT.md', template('project/PROJECT.md', {
    PROJECT_NAME: path.basename(root), PROFILES: profiles.join(', ') || 'generic (no stack profile selected)'
  }));
  const sourceTop = git(KIT, 'rev-parse', '--show-toplevel');
  const ownCheckout = sourceTop !== null && fs.realpathSync(sourceTop) === fs.realpathSync(KIT);
  const sourceStatus = ownCheckout ? git(KIT, 'status', '--porcelain') : null;
  const manifest = {
    schemaVersion: 1, kit: 'oxk', version: pkg.version,
    upstream: JSON.parse(fs.readFileSync(path.join(KIT, 'provenance.json'), 'utf8')),
    sourceCommit: ownCheckout ? git(KIT, 'rev-parse', 'HEAD') : null,
    sourceDirty: sourceStatus === null ? null : Boolean(sourceStatus),
    createdAt: previous?.createdAt || new Date().toISOString(),
    profiles, localPi, agentsBlockHash: hash(block), managed
  };
  enqueue('.agent/oxk.json', json(manifest));
  if (conflicts.length) throw new Error(`Managed-file conflict; nothing written:\n${conflicts.map(f => '  ' + f).join('\n')}\nCompare local edits with the kit and resolve intentionally. No force overwrite is available.`);
  if (!flags['dry-run']) {
    for (const item of plan) atomicWrite(safeFile(root, item.path), item.content);
  }
  console.log(`${flags['dry-run'] ? 'Preview' : 'Applied'} oxk ${pkg.version} to ${root}`);
  for (const item of plan) console.log(`${item.action} ${item.path}`);
  if (!plan.length) console.log('No changes.');
  console.log('Project context and existing task files are preserved. Fill/verify PROJECT.md before implementation.');
}

function slug(value) {
  if (!value || value.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error('Task slug must use lowercase letters/numbers and single hyphens, up to 64 characters.');
  return value;
}

function createTask(root, value, flags) {
  loadManifest(root, true);
  const name = slug(value), mode = flags.mode || 'task';
  if (!MODES.includes(mode)) throw new Error(`Mode must be one of: ${MODES.join(', ')}`);
  const ui = Boolean(flags.ui || mode === 'ui');
  const relative = `.agent/tasks/${name}`, directory = safeFile(root, relative);
  if (fs.existsSync(directory)) throw new Error(`Task already exists; no files replaced: ${relative}`);
  const values = { TASK_NAME: name, MODE: mode, UI: ui ? 'required; see DESIGN.md' : 'not required',
    CREATED: new Date().toISOString(), BASE_COMMIT: git(root, 'rev-parse', 'HEAD') || 'unavailable (Git/HEAD not verified)' };
  const filenames = ['TASK.md', 'STATUS.md', 'REVIEW.md', ...(ui ? ['DESIGN.md'] : [])];
  const items = filenames.map(file => ({ file, content: template(`task/${file}`, values) }));
  if (!flags['dry-run']) {
    // Exclusive directory creation protects an existing task from accidental reuse.
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    fs.mkdirSync(directory);
    try {
      for (const item of items) atomicWrite(path.join(directory, item.file), item.content);
    } catch (error) {
      // Remove only our exact writes; retain any unexpected external content.
      for (const item of items) if (read(path.join(directory, item.file)) === item.content) fs.unlinkSync(path.join(directory, item.file));
      try { fs.rmdirSync(directory); } catch {}
      throw error;
    }
  }
  console.log(`${flags['dry-run'] ? 'Preview task' : 'Created task'} ${relative} (${mode})`);
  for (const item of items) console.log(`create ${relative}/${item.file}`);
  console.log(`Next: /oxk-control ${relative}`);
}

function doctor(root, flags) {
  const manifest = loadManifest(root, true), errors = [], warnings = [];
  for (const [relative, expected] of Object.entries(manifest.managed)) {
    const content = read(safeFile(root, relative));
    if (content === null) errors.push(`Missing managed file: ${relative}`);
    else if (hash(content) !== expected) errors.push(`Locally modified managed file: ${relative}`);
  }
  const parts = agentsParts(read(safeFile(root, 'AGENTS.md')) || '');
  if (!parts || hash(parts.block) !== manifest.agentsBlockHash) errors.push('Missing or modified oxk block in AGENTS.md');
  const context = read(safeFile(root, '.agent/PROJECT.md'));
  if (context === null) errors.push('Missing .agent/PROJECT.md');
  else if (/\bTODO\b/.test(context)) warnings.push('PROJECT.md still has TODOs; resolve consequential ones before readiness.');
  if (manifest.version !== pkg.version) warnings.push(`Project snapshot ${manifest.version}; this checkout ${pkg.version}. Use init --dry-run to inspect an update.`);
  if (manifest.localPi) warnings.push('Project-local pi resources are enabled. Avoid loading the oxk package too.');
  if (flags.task) {
    const name = slug(flags.task);
    for (const file of ['TASK.md', 'STATUS.md', 'REVIEW.md']) {
      if (read(safeFile(root, `.agent/tasks/${name}/${file}`)) === null) errors.push(`Missing task file: .agent/${name}/${file}`);
    }
    const task = read(safeFile(root, `.agent/tasks/${name}/TASK.md`));
    if (task && /UI contract: required/.test(task) && read(safeFile(root, `.agent/tasks/${name}/DESIGN.md`)) === null) errors.push('UI task is missing DESIGN.md');
    if (task && /\bTODO\b/.test(task)) warnings.push('Task still has TODOs; doctor does not establish implementation readiness.');
  }
  const report = { kit: 'oxk', version: manifest.version, sourceCommit: manifest.sourceCommit, profiles: manifest.profiles, localPi: manifest.localPi, project: root,
    repositoryHead: git(root, 'rev-parse', 'HEAD'), errors, warnings,
    limit: 'File/context check only; live models, extensions, budgets, CI and shipping permissions are not verified.' };
  if (flags.json) console.log(json(report));
  else {
    console.log(`oxk snapshot ${manifest.version} — ${root}`);
    errors.forEach(x => console.log(`ERROR ${x}`));
    warnings.forEach(x => console.log(`WARN ${x}`));
    console.log(errors.length ? 'File integrity needs attention.' : 'File integrity passed.');
    console.log(report.limit);
  }
  if (errors.length) process.exitCode = 1;
}

function checkKit() {
  const errors = [];
  const skill = read(path.join(KIT, 'skills/oxk/SKILL.md')) || '';
  if (!/^---\nname: oxk\ndescription: .+\n---\n/.test(skill)) errors.push('Invalid oxk skill frontmatter');
  const exposed = ['skills/oxk/SKILL.md', 'BOOTSTRAP.md', 'README.md', 'templates/project/AGENTS.block.md', 'templates/project/PROJECT.md'];
  for (const file of exposed) if (!read(path.join(KIT, file))) errors.push(`Missing required kit file: ${file}`);
  for (const directory of ['prompts', 'skills/oxk', 'templates']) {
    for (const relative of filesUnder(path.join(KIT, directory))) {
      if (!relative.endsWith('.md')) continue;
      const full = path.join(KIT, directory, relative), content = fs.readFileSync(full, 'utf8');
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (target && !/^[a-z]+:/i.test(target) && !fs.existsSync(path.resolve(path.dirname(full), target))) errors.push(`Broken reference: ${directory}/${relative} → ${target}`);
      }
      if (directory !== 'templates' && /\[TODO/.test(content)) errors.push(`Unfinished authoring scaffold: ${directory}/${relative}`);
    }
  }
  for (const name of ['control', 'grill', 'implement', 'review']) {
    const prompt = read(path.join(KIT, `prompts/oxk-${name}.md`));
    if (!prompt?.startsWith('---\n') || !prompt.includes('$@')) errors.push(`Missing or invalid prompt: ${name}`);
  }
  const lock = JSON.parse(read(path.join(KIT, 'upstreams.lock.json')) || '{}');
  if (lock.schemaVersion !== 1 || !Array.isArray(lock.sources)) errors.push('Invalid reference lock');
  else for (const source of lock.sources) if (!/^[a-f0-9]{40}$/.test(source.commit) || source.referenceOnly !== true) errors.push(`Invalid source pin: ${source.id}`);
  const tokens = new Set(['PROJECT_NAME', 'PROFILES', 'TASK_NAME', 'MODE', 'UI', 'CREATED', 'BASE_COMMIT']);
  for (const relative of filesUnder(path.join(KIT, 'templates'))) for (const match of fs.readFileSync(path.join(KIT, 'templates', relative), 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g)) {
    if (!tokens.has(match[1])) errors.push(`Unknown template token: ${match[1]}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`oxk ${pkg.version}: kit structure, prompts, references, pins and template tokens passed.`);
}

try {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('oxk requires Node.js 20 or newer.');
  const input = parse(process.argv.slice(2));
  if (input.command === 'help') help();
  else if (input.command === 'check-kit') checkKit();
  else {
    const root = projectRoot(input.flags.project);
    if (input.command === 'init') init(root, input.flags);
    else if (input.command === 'task') createTask(root, input.positional[0], input.flags);
    else doctor(root, input.flags);
  }
} catch (error) {
  console.error(`oxk: ${error.message}`);
  process.exitCode = 1;
}
