/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests/e2e',
  timeout: 60000,
  reporter: 'list',
  use: {
    headless: true,
  },
};
