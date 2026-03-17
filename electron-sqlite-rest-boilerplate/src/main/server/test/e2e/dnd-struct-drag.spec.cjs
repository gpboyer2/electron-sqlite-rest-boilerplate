const fs = require('fs')
const path = require('path')
const { test, expect } = require('@playwright/test')

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:9300'
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:9200'

function ensure_dir(dir_path) {
  fs.mkdirSync(dir_path, { recursive: true })
}

async function fetch_json(url) {
  const res = await fetch(url)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text, _status: res.status, _url: url }
  }
}

async function post_json(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body)
  })
  const text = await res.text()
  try {
    return { status: res.status, json: JSON.parse(text) }
  } catch {
    return { status: res.status, json: { _raw: text, _url: url } }
  }
}

async function login_and_get_token() {
  const { status, json } = await post_json(`${BACKEND_URL}/api/auth/login`, {
    username: process.env.E2E_USERNAME || 'admin',
    password: process.env.E2E_PASSWORD || 'admin123'
  })
  return {
    status,
    json,
    token: json?.datum?.accessToken,
    refresh_token: json?.datum?.refreshToken,
    user: json?.datum?.user
  }
}

async function get_protocol_algorithm_id(auth_token) {
  // 优先按关键词定位（可通过 E2E_KEYWORD 覆盖）
  const keyword = process.env.E2E_KEYWORD || 'Location'
  const url =
    `${BACKEND_URL}/api/packet-messages/manage/list` +
    `?current_page=1&page_size=50&keyword=${encodeURIComponent(keyword)}`
  const obj = await fetch(url, {
    headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : {}
  })
    .then((r) => r.text())
    .then((t) => {
      try {
        return JSON.parse(t)
      } catch {
        return { _raw: t }
      }
    })
  const list = obj?.datum?.list || obj?.datum || []
  const first = Array.isArray(list) ? list[0] : null
  const id = first?.draft_id ?? first?.id
  return { id, keyword, raw: obj }
}

test('drag struct child out after struct (capture frontend logs)', async ({ page }) => {
  const artifacts_dir = path.resolve(__dirname, 'artifacts')
  ensure_dir(artifacts_dir)

  const pw_console_lines = []
  page.on('console', (msg) => {
    try {
      const text = msg.text()
      if (String(text).includes('[DND_DEBUG]')) {
        pw_console_lines.push(text)
      }
    } catch {}
  })

  const login = await login_and_get_token()
  fs.writeFileSync(
    path.join(artifacts_dir, 'auth-login.json'),
    JSON.stringify(login.json, null, 2),
    'utf8'
  )
  expect(login.token, 'login should return accessToken').toBeTruthy()

  // 注入前端登录态（Pinia persistedstate: user-store）
  const user = login.user || {}
  const user_store_payload = {
    token: login.token,
    refreshToken: login.refresh_token || '',
    userInfo: {
      id: String(user.id || '1'),
      username: String(user.username || 'admin'),
      nickname: String(user.realName || user.username || 'admin'),
      email: String(user.email || ''),
      avatar: '',
      permissions: user.permissions || ['*'],
      roles: [user.roleName || '超级管理员'],
      status: user.status === 1 ? 'active' : 'inactive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    permissions: user.permissions || ['*'],
    roles: [user.roleName || '超级管理员']
  }
  await page.addInitScript((payload) => {
    localStorage.setItem('user-store', JSON.stringify(payload))
  }, user_store_payload)

  const meta = await get_protocol_algorithm_id(login.token)
  fs.writeFileSync(
    path.join(artifacts_dir, 'packet-manage-list.json'),
    JSON.stringify(meta.raw, null, 2),
    'utf8'
  )
  expect(meta.id, 'protocolAlgorithmId should be resolvable from manage/list').toBeTruthy()

  const url =
    `${FRONTEND_URL}/#/editor/ide/protocol` +
    `?protocolAlgorithmId=${encodeURIComponent(String(meta.id))}` +
    `&mode=draft&view=definition&rightTab=field-props`

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  // 等待字段列表渲染
  const item_sel = '.protocol-content-list .field-item'
  await expect(page.locator(item_sel).first()).toBeVisible()

  // 计算 struct、其子字段、以及 struct 块之后的下一个 level=0 根字段索引
  const indices = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.protocol-content-list .field-item'))
    const get_level = (el) => Number(el?.dataset?.debugLevel || '0')
    const get_type = (el) => String(el?.dataset?.debugFieldType || '')
    const struct_index = items.findIndex((el) => get_type(el) === 'Struct')
    if (struct_index < 0) return { struct_index: -1, child_index: -1, next_root_index: -1 }

    const child_index = struct_index + 1 < items.length ? struct_index + 1 : -1
    const next_root_index = (() => {
      for (let i = struct_index + 1; i < items.length; i++) {
        if (get_level(items[i]) === 0) return i
      }
      return -1
    })()

    return { struct_index, child_index, next_root_index }
  })

  // 截图：拖拽前
  await page.screenshot({ path: path.join(artifacts_dir, 'before-drag.png'), fullPage: true })

  expect(indices.struct_index).toBeGreaterThanOrEqual(0)
  expect(indices.child_index).toBeGreaterThan(indices.struct_index)
  expect(indices.next_root_index).toBeGreaterThan(indices.child_index)

  const child = page.locator(item_sel).nth(indices.child_index)
  const target = page.locator(item_sel).nth(indices.next_root_index)
  const dragged_id = await child.getAttribute('data-debug-field-id')
  expect(dragged_id, 'dragged item should have data-debug-field-id').toBeTruthy()

  // 将 struct 子字段拖到 struct 块后面
  // 注意：此列表启用了 handle=".field-drag-handle"，必须从 handle 起拖才会触发 Sortable 事件
  const child_handle = child.locator('.field-drag-handle')
  await child_handle.scrollIntoViewIfNeeded()

  // 落点：下一个根字段顶部（即 Struct 块之后）
  // 使用 Playwright 的 dragTo（比手写 mouse 更稳定）
  await child_handle.dragTo(target, { targetPosition: { x: 10, y: 5 } })

  // 等待拖拽事件与日志 flush（FrontendLogger 默认 2s flush）
  await page.waitForTimeout(2600)

  // 截图：拖拽后
  await page.screenshot({ path: path.join(artifacts_dir, 'after-drag.png'), fullPage: true })

  // 断言：拖拽字段仍然存在（不消失）
  await expect(page.locator(`[data-debug-field-id="${dragged_id}"]`)).toHaveCount(1)

  // 保存 Playwright 控制台抓到的 DND_DEBUG（不依赖 WebSocket 入库延迟）
  fs.writeFileSync(
    path.join(artifacts_dir, 'playwright-console-dnd-debug.txt'),
    pw_console_lines.join('\n'),
    'utf8'
  )

  // 抓取前端日志：考虑 WebSocket 入库延迟，做短轮询
  const logs_url = `${BACKEND_URL}/api/logs/frontend/query?current_page=1&page_size=1000`
  let logs = null
  for (let i = 0; i < 12; i++) {
    logs = await fetch_json(logs_url)
    const list = logs?.datum?.list || []
    const has_debug = (list || []).some((s) => String(s).includes('[DND_DEBUG]'))
    if (has_debug) break
    await page.waitForTimeout(500)
  }
  fs.writeFileSync(
    path.join(artifacts_dir, 'frontend-logs.json'),
    JSON.stringify(logs, null, 2),
    'utf8'
  )

  // 输出 DND_DEBUG 行（便于 CI/本地直接看）
  const list = logs?.datum?.list || []
  const debug_lines = (list || []).filter((s) => String(s).includes('[DND_DEBUG]'))
  fs.writeFileSync(
    path.join(artifacts_dir, 'frontend-logs-dnd-debug.txt'),
    debug_lines.join('\n'),
    'utf8'
  )
})
