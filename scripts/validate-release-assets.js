const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'release', 'manifest.v1.json');

function fail(message) {
  console.error(`Release validation failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing manifest at ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const missing = [];

const required = manifest.required || {};
const requiredFiles = [
  required.whisperExe,
  required.ffmpegExe,
  ...(Array.isArray(required.models) ? required.models : []),
].filter(Boolean);

requiredFiles.forEach((relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    missing.push(relativePath);
  }
});

if (required.whisperExe && required.whisperDllGlob) {
  const whisperDir = path.join(projectRoot, path.dirname(required.whisperExe));
  if (fs.existsSync(whisperDir)) {
    const dlls = fs.readdirSync(whisperDir).filter((file) => file.toLowerCase().endsWith('.dll'));
    if (dlls.length === 0) {
      missing.push(required.whisperDllGlob);
    }
  } else {
    missing.push(required.whisperDllGlob);
  }
}

if (missing.length > 0) {
  console.error('Missing required release assets:');
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Release validation passed.');
