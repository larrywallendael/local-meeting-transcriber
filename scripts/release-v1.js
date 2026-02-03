const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const expectedVersion = '1.0.3';

if (version !== expectedVersion) {
  console.error(`release:v1 expects version ${expectedVersion}, but package.json is ${version}`);
  process.exit(1);
}

const hashFile = (relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  const content = fs.readFileSync(absolutePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
};

const releaseMarkers = [
  'src/renderer/components/layout/Sidebar.tsx',
  'src/renderer/contexts/JobContext.tsx',
  'src/renderer/components/settings/SettingsOverlay.tsx',
  'src/renderer/App.tsx',
  'src/main/paths.ts',
  'src/main/jobRunner.ts',
];

console.log('Release version:', version);
console.log('Release markers (sha256 short):');
releaseMarkers.forEach((file) => {
  console.log(`- ${file}: ${hashFile(file)}`);
});

const npmExecPath = process.env.npm_execpath;
const nodeExecPath = process.execPath;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const runViaNpm = (args) => {
  if (npmExecPath) {
    run(nodeExecPath, [npmExecPath, ...args]);
    return;
  }
  run(npmCmd, args);
};

const runViaNpx = (args) => {
  if (npmExecPath) {
    run(nodeExecPath, [npmExecPath, 'exec', '--', ...args]);
    return;
  }
  run(npxCmd, args);
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const cleanOldDistArtifacts = () => {
  const distDir = path.join(projectRoot, 'dist-electron');
  if (!fs.existsSync(distDir)) {
    return;
  }
  const entries = fs.readdirSync(distDir);
  entries.forEach((entry) => {
    if (entry.toLowerCase().endsWith('.exe') || entry.toLowerCase().endsWith('.blockmap')) {
      fs.rmSync(path.join(distDir, entry), { force: true });
    }
  });
};

run(process.execPath, [path.join(projectRoot, 'scripts', 'validate-release-assets.js')]);
cleanOldDistArtifacts();
runViaNpm(['run', 'build']);
runViaNpx(['electron-builder', '--win', '--config', 'electron-builder.yml']);

const distDir = path.join(projectRoot, 'dist-electron');
if (!fs.existsSync(distDir)) {
  console.error('dist-electron output not found.');
  process.exit(1);
}

const exeFiles = fs.readdirSync(distDir).filter((file) => file.toLowerCase().endsWith('.exe'));
if (exeFiles.length === 0) {
  console.error('No installer .exe found in dist-electron.');
  process.exit(1);
}

const versionTag = version.toLowerCase();
const setupFile = exeFiles.find((file) => /setup/i.test(file) && file.toLowerCase().includes(versionTag));
if (!setupFile) {
  console.error(`No installer .exe found for version ${version} in dist-electron.`);
  process.exit(1);
}
const outputDir = path.join(projectRoot, 'release', version);
fs.mkdirSync(outputDir, { recursive: true });

const now = new Date();
const dateStamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

const outputName = `LocalScribe-${version}-${dateStamp}-Setup.exe`;
const outputPath = path.join(outputDir, outputName);

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { force: true });
}

fs.copyFileSync(path.join(distDir, setupFile), outputPath);
console.log(`Release created: ${outputPath}`);
