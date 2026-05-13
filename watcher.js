const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = __dirname;
const LOG_FILE = path.join(PROJECT_DIR, 'auto-commit.log');
const DEBOUNCE_MS = 3000;
const IGNORE = ['.git', 'auto-commit.log', 'node_modules', 'watcher.js'];

let debounceTimer = null;
let changedFiles = new Set();

function log(message) {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  process.stdout.write(entry);
}

function shouldIgnore(filename) {
  return !filename || IGNORE.some(p => filename.includes(p));
}

function autoCommit() {
  try {
    const status = execSync('git status --porcelain', { cwd: PROJECT_DIR }).toString().trim();
    if (!status) {
      log('No changes to commit.');
      changedFiles.clear();
      return;
    }

    const label = [...changedFiles].slice(0, 5).join(', ');
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const message = `Auto-commit: ${timestamp} | ${label}`;

    execSync('git add -A', { cwd: PROJECT_DIR });
    execSync(`git commit -m "${message.replace(/"/g, "'")}"`, { cwd: PROJECT_DIR });
    execSync('git push origin main', { cwd: PROJECT_DIR });

    log(`Pushed: ${message}`);
  } catch (err) {
    log(`ERROR: ${err.message.split('\n')[0]}`);
  } finally {
    changedFiles.clear();
  }
}

log(`Watcher started — monitoring ${PROJECT_DIR}`);

fs.watch(PROJECT_DIR, { recursive: true }, (eventType, filename) => {
  if (shouldIgnore(filename)) return;
  changedFiles.add(filename);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    log(`Change detected: ${[...changedFiles].join(', ')}`);
    autoCommit();
  }, DEBOUNCE_MS);
});
