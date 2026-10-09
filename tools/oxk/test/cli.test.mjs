import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(kit, 'bin/oxk.mjs');
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'oxk-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return base;
}
function run(root, args, script = entry) {
  const capture = fs.mkdtempSync(path.join(os.tmpdir(), 'oxk-capture-'));
  const stdout = path.join(capture, 'stdout'), stderr = path.join(capture, 'stderr');
  const out = fs.openSync(stdout, 'w'), err = fs.openSync(stderr, 'w');
  try {
    const result = spawnSync(process.execPath, [script, ...args, '--project', root], { stdio: ['ignore', out, err], timeout: 20000 });
    return { ...result, stdout: fs.readFileSync(stdout, 'utf8'), stderr: fs.readFileSync(stderr, 'utf8') };
  } finally {
    fs.closeSync(out); fs.closeSync(err); fs.rmSync(capture, { recursive: true, force: true });
  }
}
function ok(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
function content(root, relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
function inventory(root) {
  const values = {};
  function walk(directory, prefix = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.join(prefix, item.name);
      if (item.isDirectory()) walk(path.join(directory, item.name), relative);
      else values[relative] = item.isSymbolicLink() ? fs.readlinkSync(path.join(directory, item.name)) : fs.readFileSync(path.join(directory, item.name), 'base64');
    }
  }
  walk(root);
  return values;
}

test('dry-run leaves an existing project byte-for-byte unchanged and creates no new root', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Existing policy\nUse the company conventions.\n');
  const before = inventory(root);
  ok(run(root, ['init', '--local-pi', '--dry-run']));
  assert.deepEqual(inventory(root), before);
  const absent = path.join(root, 'new-app');
  ok(run(absent, ['init', '--dry-run']));
  assert.equal(fs.existsSync(absent), false);
});

test('bootstrap is idempotent, preserves project context and app guidance, and isolates tasks', t => {
  const root = fixture(t);
  const guidance = '# Existing policy\nKeep our architecture.\n';
  fs.writeFileSync(path.join(root, 'AGENTS.md'), guidance);
  fs.mkdirSync(path.join(root, '.agent'));
  fs.writeFileSync(path.join(root, '.agent/PROJECT.md'), '# Curated context\nActual commands and decisions.\n');
  ok(run(root, ['init', '--profiles', 'react-vite,spring-boot']));
  ok(run(root, ['task', 'first-slice', '--mode', 'ui']));
  const before = inventory(root);
  ok(run(root, ['init']));
  assert.deepEqual(inventory(root), before);
  assert.ok(content(root, 'AGENTS.md').startsWith(guidance));
  assert.equal(content(root, '.agent/PROJECT.md'), '# Curated context\nActual commands and decisions.\n');
  assert.ok(fs.existsSync(path.join(root, '.agent/tasks/first-slice/DESIGN.md')));
  const report = run(root, ['doctor', '--task', 'first-slice', '--json']);
  ok(report);
  assert.deepEqual(JSON.parse(report.stdout).errors, []);
});

test('upgrades replace untouched workflow files but preserve unrelated AGENTS edits and task data', t => {
  const base = fixture(t), root = path.join(base, 'app'), copy = path.join(base, 'kit');
  fs.cpSync(kit, copy, { recursive: true, filter: source => !source.includes(path.sep + '.git') && !source.includes('node_modules') });
  const script = path.join(copy, 'bin/oxk.mjs');
  ok(run(root, ['init'], script));
  ok(run(root, ['task', 'approved-task'], script));
  fs.appendFileSync(path.join(root, 'AGENTS.md'), '\n# Local rule\nKeep approved decisions.\n');
  fs.appendFileSync(path.join(root, '.agent/PROJECT.md'), '\nUser-maintained commands.\n');
  const task = content(root, '.agent/tasks/approved-task/TASK.md');
  const source = path.join(copy, 'skills/oxk/references/core.md');
  fs.appendFileSync(source, '\nUpgrade note.\n');
  ok(run(root, ['init'], script));
  assert.ok(content(root, '.agent/workflow/core.md').endsWith('\nUpgrade note.\n'));
  assert.ok(content(root, 'AGENTS.md').endsWith('\n# Local rule\nKeep approved decisions.\n'));
  assert.ok(content(root, '.agent/PROJECT.md').endsWith('\nUser-maintained commands.\n'));
  assert.equal(content(root, '.agent/tasks/approved-task/TASK.md'), task);
});

test('a managed conflict aborts the complete plan before any update', t => {
  const base = fixture(t), root = path.join(base, 'app'), copy = path.join(base, 'kit');
  fs.cpSync(kit, copy, { recursive: true, filter: source => !source.includes(path.sep + '.git') && !source.includes('node_modules') });
  const script = path.join(copy, 'bin/oxk.mjs');
  ok(run(root, ['init'], script));
  fs.appendFileSync(path.join(root, '.agent/workflow/core.md'), '\nIntentional local edit.\n');
  fs.appendFileSync(path.join(copy, 'skills/oxk/references/roles.md'), '\nNew release note.\n');
  fs.writeFileSync(path.join(copy, 'skills/oxk/references/new.md'), 'New file should not be written.\n');
  const before = inventory(root);
  const result = run(root, ['init'], script);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /conflict; nothing written/);
  assert.deepEqual(inventory(root), before);
  assert.equal(fs.existsSync(path.join(root, '.agent/workflow/new.md')), false);
  const report = run(root, ['doctor', '--json'], script);
  assert.equal(report.status, 1);
  assert.match(report.stdout, /Locally modified managed file/);
});

test('task path traversal, existing tasks and bad mode are rejected without mutations', t => {
  const root = fixture(t);
  ok(run(root, ['init']));
  ok(run(root, ['task', 'first-task']));
  const before = inventory(root);
  for (const args of [['task', '../escape'], ['task', 'first-task'], ['task', 'new-task', '--mode', 'invalid'], ['task', 'UPPER']]) {
    assert.equal(run(root, args).status, 1);
    assert.deepEqual(inventory(root), before);
  }
  assert.equal(fs.existsSync(path.join(root, '.agent/tasks/first-task/DESIGN.md')), false);
  ok(run(root, ['task', 'night-ui', '--mode', 'overnight', '--ui']));
  assert.ok(fs.existsSync(path.join(root, '.agent/tasks/night-ui/DESIGN.md')));
  assert.match(content(root, '.agent/tasks/night-ui/TASK.md'), /Mode: overnight/);
  assert.match(content(root, '.agent/tasks/night-ui/TASK.md'), /Delivery: reviewed/);
});

test('managed symlinks cannot redirect writes, including dangling symlinks', t => {
  const base = fixture(t), root = path.join(base, 'app'), outside = path.join(base, 'outside');
  fs.mkdirSync(root); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, '.agent'), 'dir');
  const result = run(root, ['init']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing symlink/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  fs.unlinkSync(path.join(root, '.agent'));
  fs.symlinkSync(path.join(base, 'missing'), path.join(root, 'AGENTS.md'));
  assert.equal(run(root, ['init']).status, 1);
  assert.equal(fs.existsSync(path.join(root, '.agent')), false);
});

test('ambiguous, removed and reversed AGENTS markers protect existing content', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '<!-- oxk:start -->x<!-- oxk:start -->y<!-- oxk:end -->');
  assert.equal(run(root, ['init']).status, 1);
  assert.equal(fs.existsSync(path.join(root, '.agent')), false);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '<!-- oxk:end --><!-- oxk:start -->');
  assert.equal(run(root, ['init']).status, 1);
  fs.unlinkSync(path.join(root, 'AGENTS.md'));
  ok(run(root, ['init']));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Deliberately removed oxk block\n');
  const before = inventory(root);
  assert.equal(run(root, ['init']).status, 1);
  assert.deepEqual(inventory(root), before);
});

test('local pi mode is opt-in and copied skill references remain self-contained', t => {
  const root = fixture(t);
  ok(run(root, ['init']));
  assert.equal(fs.existsSync(path.join(root, '.pi')), false);
  assert.equal(fs.existsSync(path.join(root, '.agents')), false);
  ok(run(root, ['init', '--local-pi']));
  assert.ok(fs.existsSync(path.join(root, '.pi/prompts/oxk-review.md')));
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/oxk/references/workflows/ui.md')));
  assert.equal(fs.existsSync(path.join(root, '.pi/settings.json')), false);
  const before = inventory(root);
  ok(run(root, ['init']));
  assert.deepEqual(inventory(root), before);
});

test('doctor flags missing evidence files; invalid flags, profiles and manifest fail before writes', t => {
  const root = fixture(t);
  for (const args of [['init', '--force'], ['init', '--profiles', 'unknown'], ['init', '--profiles'], ['doctor']]) {
    assert.equal(run(root, args).status, 1);
    assert.deepEqual(fs.readdirSync(root), []);
  }
  ok(run(root, ['init']));
  ok(run(root, ['task', 'ui-task', '--ui']));
  fs.unlinkSync(path.join(root, '.agent/tasks/ui-task/DESIGN.md'));
  assert.equal(run(root, ['doctor', '--task', 'ui-task', '--json']).status, 1);
  fs.writeFileSync(path.join(root, '.agent/oxk.json'), '{"schemaVersion": 9}\n');
  const before = inventory(root);
  assert.equal(run(root, ['init']).status, 1);
  assert.deepEqual(inventory(root), before);
});


test('FaSearch profiles preserve legacy packets and create only canonical task directories', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.agent/tasks/legacy'), { recursive: true });
  for (const file of ['TASK.md', 'STATUS.md', 'REVIEW.md']) fs.writeFileSync(path.join(root, '.agent/tasks/legacy', file), 'Legacy evidence\n');
  ok(run(root, ['init', '--profiles', 'nextjs,spring-boot,fastapi', '--local-pi']));
  ok(run(root, ['task', 'new-ui', '--mode', 'ui']));
  assert.equal(fs.existsSync(path.join(root, '.agent/new-ui')), false);
  assert.equal(content(root, '.agent/tasks/legacy/STATUS.md'), 'Legacy evidence\n');
  assert.ok(fs.existsSync(path.join(root, '.agent/tasks/new-ui/DESIGN.md')));
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/oxk/agents/openai.yaml')));
  assert.match(content(root, '.agent/tasks/new-ui/STATUS.md'), /State: DRAFT/);
  const report = run(root, ['doctor', '--task', 'new-ui', '--json']);
  ok(report);
  assert.deepEqual(JSON.parse(report.stdout).profiles, ['nextjs', 'spring-boot', 'fastapi']);
  assert.equal(run(root, ['task', 'legacy']).status, 1);
  const before = inventory(root);
  ok(run(root, ['task', 'preview-only', '--dry-run']));
  assert.deepEqual(inventory(root), before);
});
