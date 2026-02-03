const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

const rootDir = path.resolve(__dirname, '..', '..');

let devServer;

test.beforeAll(async () => {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  devServer = spawn(npmCmd, ['run', 'dev:renderer'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: 'none' },
  });
  await waitOn({ resources: ['http://localhost:5173'], timeout: 60000 });
});

test.afterAll(async () => {
  if (devServer) {
    devServer.kill();
  }
});

test('screen transitions do not trigger reload screen', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
      OPEN_DEVTOOLS: 'false',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('text=My transcripts', { timeout: 30000 });

  await expect(page.locator('text=Oops, the screen took a nap.')).toHaveCount(0);

  const settingsButton = page.getByRole('button', { name: /Settings/i });
  if (await settingsButton.count()) {
    await settingsButton.first().click();
    await page.waitForSelector('text=Settings', { timeout: 10000 });
    await page.keyboard.press('Escape');
  }

  await page.keyboard.press('Control+K');
  await page.waitForSelector('text=Search', { timeout: 10000 });
  await page.keyboard.press('Escape');

  await expect(page.locator('text=Oops, the screen took a nap.')).toHaveCount(0);

  await app.close();
});
