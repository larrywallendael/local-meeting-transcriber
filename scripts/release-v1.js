const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const expectedVersion = '1.0.0';

if (version !== expectedVersion) {
  console.error(`release:v1 expects version ${expectedVersion}, but package.json is ${version}`);
  process.exit(1);
}

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

run(process.execPath, [path.join(projectRoot, 'scripts', 'validate-release-assets.js')]);
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

const setupFile = exeFiles.find((file) => /setup/i.test(file)) || exeFiles[0];
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
  console.error(`Release artifact already exists: ${outputPath}`);
  process.exit(1);
}

fs.copyFileSync(path.join(distDir, setupFile), outputPath);
console.log(`Release created: ${outputPath}`);
