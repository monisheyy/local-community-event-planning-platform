// Builds the React app and copies it into backend/public so ONE Azure App Service
// serves both the API and the frontend. Works on Windows, macOS and Linux.
// Usage: npm run build:azure   -> then zip the contents of the backend folder (without node_modules)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
execSync('npm run build', { cwd: path.join(root, 'frontend'), stdio: 'inherit' });
const target = path.join(root, 'backend', 'public');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(path.join(root, 'frontend', 'dist'), target, { recursive: true });
console.log(`\nCopied frontend build to ${target}`);
console.log('Next: zip the backend folder contents (exclude node_modules, data, uploads) and deploy - see docs/AZURE_DEPLOYMENT.md');
