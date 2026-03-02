#!/usr/bin/env node
const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString();
  } catch (e) {
    return '';
  }
}

console.log('predev: checking port 3000...');
const platform = process.platform;

try {
  if (platform === 'win32') {
    const out = run('netstat -ano -p tcp');
    const lines = out.split(/\r?\n/).filter(Boolean);
    const using = lines.filter(l => l.includes(':3000'));
    if (using.length === 0) {
      console.log('predev: port 3000 is free.');
      process.exit(0);
    }
    const pids = [...new Set(using.map(l => l.trim().split(/\s+/).pop()))].filter(Boolean);
    console.log('predev: found PIDs using port 3000:', pids.join(', '));
    for (const pid of pids) {
      try {
        console.log(`predev: killing PID ${pid}...`);
        run(`taskkill /PID ${pid} /F`);
      } catch (e) {
        console.error('predev: failed to kill', pid, e.message || e);
      }
    }
  } else {
    // Unix-like
    const out = run('lsof -i :3000 -t');
    if (!out.trim()) {
      console.log('predev: port 3000 is free.');
      process.exit(0);
    }
    const pids = out.split(/\r?\n/).filter(Boolean);
    console.log('predev: found PIDs using port 3000:', pids.join(', '));
    for (const pid of pids) {
      try {
        console.log(`predev: killing PID ${pid}...`);
        run(`kill -9 ${pid}`);
      } catch (e) {
        console.error('predev: failed to kill', pid, e.message || e);
      }
    }
  }
} catch (e) {
  console.error('predev: error during port check:', e.message || e);
}

process.exit(0);
