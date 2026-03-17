/**
 * Playwright config (debug-only)
 * 目标：自动复现“Struct 内字段拖到 Struct 后面字段消失”的拖拽场景，并抓取前端日志证据。
 */
module.exports = {
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
}
