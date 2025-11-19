#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// Get current commit SHA
let commitSha = 'unknown';
try {
  commitSha = process.env.COMMIT_SHA || execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  // Fallback if git not available
}

// Get deployment time
const deployTime = process.env.DEPLOY_TIME || new Date().toISOString();

// Create version object
const versionInfo = {
  service: 'lightwell-photos-frontend',
  commit: commitSha,
  deployedAt: deployTime,
  environment: process.env.ENVIRONMENT || 'production',
  status: 'healthy',
};

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write version.json to dist (served as static file)
const versionPath = path.join(distDir, 'version.json');
fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));

console.log(`Generated ${versionPath}`);
console.log(JSON.stringify(versionInfo, null, 2));
