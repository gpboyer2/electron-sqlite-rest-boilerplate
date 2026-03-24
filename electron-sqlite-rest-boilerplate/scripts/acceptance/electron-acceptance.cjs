const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { _electron: electron } = require('playwright');

const projectRoot = path.resolve(__dirname, '../..');
const packagedExecutable = path.join(
  projectRoot,
  'dist/mac/Electron SQLite REST.app/Contents/MacOS/Electron SQLite REST'
);

function log(step, message, extra) {
  const prefix = `[acceptance:${step}]`;
  if (extra === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message}`, extra);
}

async function capturePageSnapshot(page, outputDir, label) {
  await fs.mkdir(outputDir, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  const screenshotPath = path.join(outputDir, `${safeLabel}.png`);
  const htmlPath = path.join(outputDir, `${safeLabel}.html`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await fs.writeFile(htmlPath, await page.content(), 'utf8');

  log('snapshot', `saved page snapshot for ${label}`, {
    screenshotPath,
    htmlPath,
    url: page.url()
  });
}

async function makeTestHome(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

async function poll(description, fn, { timeoutMs = 60000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `${description} timed out after ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`
  );
}

async function fetchEnvelope(baseUrl, pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON for ${pathname}: ${text}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${pathname}: ${text}`);
  }

  if (json.status !== 'success') {
    throw new Error(`API error for ${pathname}: ${json.message || text}`);
  }

  return json;
}

async function fetchDatum(baseUrl, pathname, init) {
  const payload = await fetchEnvelope(baseUrl, pathname, init);
  return payload.datum;
}

async function expandSidebar(page) {
  const expandButton = page.locator('button[title="展开侧边栏"], button[title="Expand"]');
  if (await expandButton.count()) {
    await expandButton.first().click();
  }
}

async function clickNav(page, labelPattern) {
  await expandSidebar(page);
  await page.getByRole('button', { name: labelPattern }).click();
}

function getCardByHeading(page, headingPattern) {
  return page.locator('.rounded-xl').filter({ hasText: headingPattern }).first();
}

async function fillInputByLabel(page, labelPattern, value, options = {}) {
  const locator = page.locator('label').filter({ hasText: labelPattern }).locator('input, textarea');
  await locator.first().fill(value, options);
}

async function fillInputIn(container, labelPattern, value, options = {}) {
  const locator = container.locator('label').filter({ hasText: labelPattern }).locator('input, textarea');
  await locator.first().fill(value, options);
}

async function waitForHeading(page, pattern) {
  await page.getByRole('heading', { name: pattern }).waitFor({ timeout: 30000 });
}

async function closeElectronApp(electronApp, label) {
  try {
    await electronApp.evaluate(({ app }) => app.quit());
  } catch (error) {
    log('cleanup', `${label} app.quit failed`, error instanceof Error ? error.message : String(error));
  }

  try {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} electronApp.close timed out`)), 5000);
      })
    ]);
  } catch (error) {
    log('cleanup', `${label} close fallback`, error instanceof Error ? error.message : String(error));
    try {
      const electronProcess = electronApp.process?.();
      if (electronProcess?.pid) {
        process.kill(electronProcess.pid, 'SIGKILL');
      }
    } catch (killError) {
      log(
        'cleanup',
        `${label} process kill failed`,
        killError instanceof Error ? killError.message : String(killError)
      );
    }
  }
}

async function startUiAcceptance() {
  const homeDir = await makeTestHome('electron-sqlite-rest-ui');
  const userDataDir = path.join(homeDir, 'userData');
  const artifactsDir = path.join(homeDir, 'artifacts');
  const consoleErrors = [];
  const pageErrors = [];
  const apiTraffic = [];

  await fs.mkdir(userDataDir, { recursive: true });
  log('ui', 'launching built Electron app from project root', { homeDir, userDataDir });

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      HOME: homeDir,
      NODE_ENV: 'production',
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_USER_DATA_DIR: userDataDir
    }
  });

  let secondInstanceChild = null;

  try {
    const page = await electronApp.firstWindow();
    page.setDefaultTimeout(20000);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.stack || error.message);
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        const line = `${request.method()} ${request.url()}`;
        apiTraffic.push(line);
        log('api-traffic', line);
      }
    });
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        log('api-traffic', `response ${response.status()} ${response.url()}`);
      }
    });

    await page.waitForLoadState('domcontentloaded');

    const apiInfo = await poll(
      'embedded API ready in built app',
      async () => {
        const info = await page.evaluate(() => window.api.getEmbeddedApiStatus());
        if (info.running && !info.initializing) {
          return info;
        }
        return false;
      },
      { timeoutMs: 90000, intervalMs: 1500 }
    );

    log('ui', 'embedded API ready', apiInfo);

    const initialWindowCount = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().length
    );
    assert.equal(initialWindowCount, 1, 'built app should start with exactly one BrowserWindow');

    const baseUrl = apiInfo.baseUrl;
    const apiBaseUrl = `${baseUrl}/api`;

    log('api', 'checking direct API endpoints');
    const health = await fetchDatum(baseUrl, '/api/health');
    assert.equal(health.status, 'healthy');

    const dashboard = await fetchDatum(baseUrl, '/api/dashboard/query');
    assert.ok(typeof dashboard.process.total === 'number');

    const chart = await fetchDatum(baseUrl, '/api/dashboard/chart?metric=cpu&time_range=60');
    assert.ok(Array.isArray(chart.list));

    const settingsBefore = await fetchDatum(baseUrl, '/api/settings/query');
    assert.ok(Array.isArray(settingsBefore.list));

    const settingKey = `acceptance.setting.${Date.now()}`;
    await fetchDatum(baseUrl, '/api/settings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: settingKey,
        value: 'v1',
        description: 'acceptance create'
      })
    });
    await fetchDatum(baseUrl, '/api/settings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: settingKey,
        value: 'v2',
        description: 'acceptance update'
      })
    });
    const updatedSetting = await fetchDatum(baseUrl, `/api/settings/query?key=${encodeURIComponent(settingKey)}`);
    assert.equal(updatedSetting.value, 'v2');
    await fetchDatum(baseUrl, '/api/settings/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [settingKey] })
    });

    const aboutBefore = await fetchDatum(baseUrl, '/api/about/query');
    const authSummary = await fetchDatum(baseUrl, '/api/auth/public-summary');
    assert.ok(Array.isArray(authSummary.demoAccounts) && authSummary.demoAccounts.length >= 2);

    const systemCrudCreate = await fetchDatum(baseUrl, '/api/system/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpu_usage: 12,
        memory_usage: 34,
        memory_total: 16384,
        memory_used: 4000,
        disk_usage: 56,
        disk_total: 512000,
        disk_used: 200000,
        network_rx: 100,
        network_tx: 200
      })
    });
    await fetchDatum(baseUrl, '/api/system/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: systemCrudCreate.id,
        cpu_usage: 77.7
      })
    });
    const systemCrudList = await fetchDatum(baseUrl, '/api/system/query?current_page=1&page_size=20');
    assert.ok(
      systemCrudList.list.some((item) => item.id === systemCrudCreate.id && item.cpu_usage === 77.7)
    );

    log('ui', 'verifying Home page');
    await waitForHeading(page, /系统监控与仪表盘|System Dashboard/);
    log('ui', 'home heading ready');
    await page.getByRole('button', { name: /刷新|Refresh/ }).click();
    log('ui', 'home refresh clicked');
    await page.locator('tr').filter({ hasText: `#${systemCrudCreate.id}` }).first().waitFor({ timeout: 20000 });
    log('ui', 'home table contains created snapshot', { id: systemCrudCreate.id });
    await page.getByText(apiInfo.baseUrl).waitFor({ timeout: 20000 });
    log('ui', 'home API base URL rendered');
    await fetchDatum(baseUrl, '/api/system/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [systemCrudCreate.id] })
    });
    log('ui', 'home direct delete cleanup finished', { id: systemCrudCreate.id });

    log('ui', 'verifying Processes page');
    await clickNav(page, /CRUD 示例|CRUD Demo/);
    await waitForHeading(page, /CRUD 示例|CRUD Demo/);
    log('ui', 'processes heading ready');
    await page.getByRole('button', { name: /填充演示数据|Fill Demo Data/ }).click();
    log('ui', 'processes fill demo clicked');
    const processNameInput = page.locator('label').filter({ hasText: /进程名称|Name/ }).locator('input').first();
    const processName = await processNameInput.inputValue();
    log('ui', 'processes generated name', { processName });
    await page.getByRole('button', { name: /^创建$|^Create$/ }).click();
    log('ui', 'processes create clicked');
    const createdProcessRow = await poll(
      'process row appears after create',
      async () => {
        const rowLocator = page.locator('tr').filter({ hasText: processName });
        return (await rowLocator.count()) ? rowLocator.first() : false;
      },
      { timeoutMs: 20000, intervalMs: 1000 }
    );
    await createdProcessRow.getByRole('button', { name: /编辑|Edit/ }).click();
    log('ui', 'processes edit clicked');
    const editedProcessName = `${processName}-edited`;
    await processNameInput.fill(editedProcessName);
    await page.getByRole('button', { name: /更新|Update/ }).click();
    log('ui', 'processes update clicked', { editedProcessName });
    await page.locator('tr').filter({ hasText: editedProcessName }).first().waitFor({ timeout: 20000 });
    const editedRow = page.locator('tr').filter({ hasText: editedProcessName }).first();
    await editedRow.getByRole('button').nth(1).click();
    log('ui', 'processes delete clicked', { editedProcessName });
    await poll(
      'process row deleted',
      async () => ((await page.locator('tr').filter({ hasText: editedProcessName }).count()) === 0 ? true : false),
      { timeoutMs: 20000, intervalMs: 1000 }
    );

    log('ui', 'verifying Auth page');
    await clickNav(page, /认证示例|Auth Demo/);
    await waitForHeading(page, /认证与权限演示|Auth Demo/);
    log('ui', 'auth heading ready');
    const loginCard = getCardByHeading(page, /登录|Login/);
    const registerCard = getCardByHeading(page, /注册 viewer 用户|Register Viewer/);
    const registeredUsername = `viewer_${Date.now()}`;
    await fillInputIn(registerCard, /用户名|Username/, registeredUsername);
    await fillInputIn(registerCard, /密码|Password/, 'viewer123');
    await fillInputIn(registerCard, /显示名称|Display Name/, 'Acceptance Viewer');
    await fillInputIn(registerCard, /^Email$/, 'acceptance@example.com');
    await registerCard.getByRole('button', { name: /^注册$|^Register$/ }).click({ force: true });
    log('ui', 'auth register clicked', { registeredUsername });
    await poll(
      'registered user appears in public summary',
      async () => {
        const summary = await fetchDatum(baseUrl, '/api/auth/public-summary');
        return summary.users.some((user) => user.username === registeredUsername) ? true : false;
      },
      { timeoutMs: 20000, intervalMs: 1000 }
    );

    await fillInputIn(loginCard, /用户名|Username/, 'admin');
    await fillInputIn(loginCard, /密码|Password/, 'admin123');
    await loginCard.getByRole('button', { name: /^登录$|^Login$/ }).click({ force: true });
    log('ui', 'auth admin login clicked');
    await page.getByText(/Template Admin|模板管理员/).waitFor({ timeout: 20000 });
    const sessionBeforeRefresh = await page.evaluate(() => window.localStorage.getItem('template-auth-session'));
    await loginCard.getByRole('button', { name: /刷新会话|Refresh Session/ }).click({ force: true });
    log('ui', 'auth refresh session clicked');
    await poll(
      'session refresh changes stored session',
      async () => {
        const nextSession = await page.evaluate(() => window.localStorage.getItem('template-auth-session'));
        return nextSession && nextSession !== sessionBeforeRefresh ? true : false;
      },
      { timeoutMs: 20000, intervalMs: 1000 }
    );
    await page.getByRole('button', { name: /调用受限示例接口|Call Protected Example/ }).click({ force: true });
    log('ui', 'auth protected example clicked as admin');
    await page
      .getByText(/这是模板里唯一默认受限的示例接口|受限接口访问成功|protected example/i)
      .waitFor({ timeout: 20000 });
    await loginCard.getByRole('button', { name: /退出登录|Logout/ }).click({ force: true });
    log('ui', 'auth admin logout clicked');
    await page.getByText(/当前没有登录会话|No active session/).waitFor({ timeout: 20000 });

    await fillInputIn(loginCard, /用户名|Username/, registeredUsername);
    await fillInputIn(loginCard, /密码|Password/, 'viewer123');
    await loginCard.getByRole('button', { name: /^登录$|^Login$/ }).click({ force: true });
    log('ui', 'auth viewer login clicked', { registeredUsername });
    await page.getByRole('button', { name: /调用受限示例接口|Call Protected Example/ }).click({ force: true });
    log('ui', 'auth protected example clicked as viewer');
    await page.getByText(/没有示例权限|no example permission|没有权限/i).waitFor({ timeout: 20000 });
    await loginCard.getByRole('button', { name: /退出登录|Logout/ }).click({ force: true });
    log('ui', 'auth viewer logout clicked');

    log('ui', 'verifying About page');
    await clickNav(page, /关于|About/);
    await waitForHeading(page, /模板总览|Template Overview/);
    log('ui', 'about heading ready');
    const descriptionLocator = page.locator('textarea').first();
    const originalDescription = await descriptionLocator.inputValue();
    const acceptanceDescription = `${originalDescription}\n[acceptance:${Date.now()}]`;
    await descriptionLocator.fill(acceptanceDescription);
    await page.getByRole('button', { name: /保存到 \/api\/about\/update|Save to \/api\/about\/update/ }).click();
    log('ui', 'about save clicked for modified description');
    await poll(
      'about description updated',
      async () => {
        const about = await fetchDatum(baseUrl, '/api/about/query');
        return about.description === acceptanceDescription ? true : false;
      },
      { timeoutMs: 20000, intervalMs: 1000 }
    );
    await descriptionLocator.fill(originalDescription);
    await page.getByRole('button', { name: /保存到 \/api\/about\/update|Save to \/api\/about\/update/ }).click();
    log('ui', 'about save clicked for restore');
    await poll(
      'about description restored',
      async () => {
        const about = await fetchDatum(baseUrl, '/api/about/query');
        return about.description === aboutBefore.description ? true : false;
      },
      { timeoutMs: 20000, intervalMs: 1000 }
    );

    const updateButton = page.getByRole('button', { name: /检查更新|Check Updates/ });
    await updateButton.click();
    log('ui', 'about check updates clicked');
    await Promise.race([
      page.getByText(/发现新版本|Update Available|当前已是最新版本|Already Up To Date|检查更新失败|Update Check Failed/).waitFor({
        timeout: 30000
      }),
      page.waitForTimeout(30000).then(() => {
        throw new Error('update dialog did not appear within 30s');
      })
    ]);

    log('single-instance', 'verifying requestSingleInstanceLock behavior');
    const electronBinary = require('electron');
    secondInstanceChild = spawn(electronBinary, ['.'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: homeDir,
        NODE_ENV: 'production',
        ELECTRON_USER_DATA_DIR: userDataDir
      },
      stdio: 'ignore'
    });
    await page.waitForTimeout(4000);
    const windowCountAfterSecondLaunch = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().length
    );
    assert.equal(
      windowCountAfterSecondLaunch,
      1,
      'second launch should not create an extra BrowserWindow'
    );

    if (consoleErrors.length || pageErrors.length) {
      throw new Error(
        `renderer errors detected\nconsoleErrors=${JSON.stringify(consoleErrors, null, 2)}\npageErrors=${JSON.stringify(pageErrors, null, 2)}`
      );
    }

    return {
      apiBaseUrl,
      homeDir,
      userDataDir,
      baseUrl,
      artifactsDir
    };
  } finally {
    try {
      const page = await electronApp.firstWindow();
      await capturePageSnapshot(page, artifactsDir, 'ui-final-state');
    } catch (error) {
      log('snapshot', 'skipped final UI snapshot', error instanceof Error ? error.message : String(error));
    }
    if (secondInstanceChild && !secondInstanceChild.killed) {
      secondInstanceChild.kill('SIGTERM');
    }
    await closeElectronApp(electronApp, 'ui');
  }
}

async function startPackagedAcceptance() {
  const homeDir = await makeTestHome('electron-sqlite-rest-packaged');
  const userDataDir = path.join(homeDir, 'userData');
  const stdout = [];
  const stderr = [];

  await fs.mkdir(userDataDir, { recursive: true });
  log('packaged', 'launching packaged app', { homeDir, userDataDir, packagedExecutable });

  const child = spawn(packagedExecutable, [], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOME: homeDir,
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_USER_DATA_DIR: userDataDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));

  try {
    const health = await poll(
      'packaged app embedded API ready',
      async () => {
        try {
          return await fetchDatum('http://127.0.0.1:9200', '/api/health');
        } catch {
          return false;
        }
      },
      { timeoutMs: 90000, intervalMs: 1500 }
    );

    assert.equal(health.status, 'healthy');
    const about = await fetchDatum('http://127.0.0.1:9200', '/api/about/query');
    const authSummary = await fetchDatum('http://127.0.0.1:9200', '/api/auth/public-summary');
    assert.ok(about.app_name);
    assert.ok(Array.isArray(authSummary.demoAccounts));

    return {
      homeDir,
      userDataDir,
      stdout: stdout.join(''),
      stderr: stderr.join('')
    };
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
  }
}

async function main() {
  const uiResult = await startUiAcceptance();
  const packagedResult = await startPackagedAcceptance();

  log('done', 'all acceptance checks passed', {
    uiRuntimeHome: uiResult.homeDir,
    uiUserDataDir: uiResult.userDataDir,
    packagedRuntimeHome: packagedResult.homeDir,
    packagedUserDataDir: packagedResult.userDataDir,
    packagedStdoutBytes: packagedResult.stdout.length,
    packagedStderrBytes: packagedResult.stderr.length
  });
}

main().catch((error) => {
  console.error('[acceptance] failed:', error);
  process.exitCode = 1;
});
