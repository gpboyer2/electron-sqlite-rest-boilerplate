# API 测试架构设计文档

## 一、设计概述

### 1.1 设计目标

构建一套完整的 API 自动化测试体系，实现：

- 全面覆盖所有 API 端点（正常流程 + 异常场景）
- 自动化执行，一键启动后端并运行测试
- 清晰简洁的测试报告（显示接口、预期、实际）
- 测试数据自动管理（创建时标记，测试后精准删除）
- 环境独立，可在开发/测试/生产环境运行

### 1.2 核心原则

1. 非独立项目 - 测试代码是 server 项目的一部分，复用现有依赖
2. 自建轻量框架 - 不依赖 Jest/Mocha，自建符合需求的测试运行器
3. 数据安全 - 测试数据添加标记字段，只删除自己生成的数据
4. 进程自动化 - 测试脚本自动管理后端进程（kill + 重启）
5. 简洁报告 - 控制台输出，显示接口、预期值、实际值

### 1.3 技术选型

| 技术     | 用途         | 说明                    |
| -------- | ------------ | ----------------------- |
| Node.js  | 运行环境     | 与后端保持一致          |
| axios    | HTTP 客户端  | 复用前端的 API 调用逻辑 |
| mockjs   | 测试数据生成 | 生成动态测试数据        |
| 自建框架 | 测试运行器   | 轻量级测试框架          |

## 二、核心设计理念（永久约束）

### 2.1 测试驱动后端（TDD 原则）

**核心原则：测试用例定义正确的业务规范，后端代码以测试为标准进行修正。**

测试驱动开发（TDD）的本质是：先写测试，测试定义了正确的行为，然后编写代码让测试通过。即使后端接口已经写好，这个原则依然适用：

1. **测试是业务规范的标准**：测试用例代表了正确的、预期的业务行为，是业务需求的可执行文档

2. **测试失败时的处理原则**：
   - 如果测试失败，首先要判断：是测试写得不对，还是后端实现不符合预期？
   - 如果是后端实现问题，**修改后端代码**，而不是修改测试将就后端
   - 测试代码是判断是非的标准，不是配角

3. **常见场景的判断准则**：

   | 场景                   | 正确做法                               | 错误做法                     |
   | ---------------------- | -------------------------------------- | ---------------------------- |
   | 后端返回格式不符合规范 | 修改后端，让其返回符合规范的格式       | 修改测试，强行适配错误的格式 |
   | 后端参数校验缺失       | 修改后端，添加参数校验                 | 修改测试，去掉校验相关的用例 |
   | 后端错误处理不当       | 修改后端，返回正确的 status 和 message | 修改测试，降低预期标准       |
   | 后端边界值处理有问题   | 修改后端，修复边界值处理逻辑           | 修改测试，跳过边界值测试     |

4. **禁止事项**：
   - [禁止] 因为后端代码已经写好，就降低测试标准
   - [禁止] 将"后端就是这样的"作为不修改测试失败的理由
   - [禁止] 修改测试来适配明显错误的业务逻辑
   - [禁止] 跳过或注释掉失败的测试用例

5. **必须遵守**：
   - [正确] 测试失败时，先分析失败原因
   - [正确] 如果是后端问题，提交 issue 或 PR 让后端修改
   - [正确] 以测试用例作为正确性的最终判断标准
   - [正确] 测试代码是项目的一部分，它的价值不低于业务代码

**为什么这样重要？**

测试代码如果迁就错误的实现，就失去了测试的意义。测试的目的是发现问题，而不是掩盖问题。当测试和实现不一致时，应该以测试为标准去修正实现，这样产品质量才能得到保证。

### 2.2 高维度全局变量 + Mock.js 动态生成

所有测试数据必须使用 Mock.js 动态生成，存储在**高维度全局变量**中。

### 2.3 测试流程（严格按此顺序）

```
1. Mock.js 动态生成用户名、密码等数据
2. 调用创建用户接口（同时测试该接口的健壮性和边界值）
3. 创建成功 -> 标记全局变量状态为可用
4. 所有后续测试使用这个全局动态数据
5. 最后一个测试：修改密码接口
6. 测试完成，100% 通过率
```

### 2.4 优势

- **无状态依赖**：每次运行都是新的随机数据，不存在"旧密码失效"问题
- **接口健壮性验证**：创建用户接口用随机数据测试，自动覆盖边界值
- **数据隔离**：每次测试运行完全独立

### 2.5 禁止事项

- [禁止] 禁止写死测试数据（如 `username: 'pwd_test_user'`, `password: 'Initial123'`）
- [禁止] 禁止使用固定字符串作为测试数据
- [禁止] 禁止依赖上次运行残留的数据

### 2.6 必须使用

- [正确] 所有测试数据用 Mock.js 动态生成
- [正确] 生成的数据存储在全局变量中
- [正确] 修改密码测试必须放在最后执行

### 2.7 实现规范示例

```javascript
// 正确示例
const mock = require('mockjs')

// 高维度全局变量
const GLOBAL_TEST_DATA = {
  user: {
    username: mock('@word'), // 动态生成
    password: mock('@string("lower", 8, 16)'), // 动态生成
    realName: mock('@cname')
    // ...
  }
}
```

## 三、架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     测试运行器层                         │
│              runner.js (程序入口)                        │
│  - 解析命令行参数                                         │
│  - 自动管理后端进程 (kill + 重启)                         │
│  - 协调各模块执行                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      HTTP 客户端层                       │
│                lib/api-client.js                         │
│  - 封装 axios，复用前端请求逻辑                           │
│  - 自动管理认证 token                                     │
│  - 请求/响应日志记录                                      │
│  - expect 预期验证                                        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      测试执行层                          │
│                lib/test-runner.js                        │
│  - 提供 test/describe 语法                                │
│  - 支持异步测试                                           │
│  - 统计执行结果                                           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     工具和辅助层                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ assertions.js│  │process-mgr.js│  │data-tracker.js│  │
│  │   断言工具    │  │   进程管理    │  │   数据追踪     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │data-cleaner.js│  │  reporter.js │                      │
│  │   数据清理     │  │   报告生成    │                      │
│  └──────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 执行流程

```
启动测试脚本
    │
    ▼
[可选] 查找并 kill 现有后端进程
    │
    ▼
启动后端服务 (child_process.spawn)
    │
    ▼
等待后端就绪 (健康检查轮询)
    │
    ▼
执行测试用例 (按模块顺序执行)
    │
    ├─► 认证模块 (登录获取 token)
    │
    ├─► 用户管理模块
    │
    ├─► 角色权限模块
    │
    └─► 业务模块 (流程图/层级/报文等)
    │
    ▼
收集测试结果
    │
    ▼
清理测试数据 (按标记字段精准删除)
    │
    ▼
输出测试报告 (控制台输出)
    │
    ▼
退出程序
```

### 3.3 目录结构

```
server/
├── package.json                 # 统一的依赖配置
├── ...（原有代码）
└── test/
    └── api/
        ├── runner.js            # 测试入口
        ├── context.js           # 全局上下文管理（共享ApiClient、DataTracker等）
        ├── lib/                 # 核心框架
        │   ├── api-client.js   # HTTP 客户端
        │   ├── test-runner.js  # 测试运行器
        │   ├── assertions.js   # 断言工具
        │   └── reporter.js     # 报告生成器
        ├── utils/               # 工具模块
        │   ├── process-manager.js  # 进程管理
        │   ├── data-tracker.js     # 数据追踪
        │   ├── data-cleaner.js     # 数据清理
        │   └── mock-data-generator.js  # Mock 数据生成
        └── modules/             # 测试模块（按功能分组）
            ├── {模块名}/
            │   ├── index.js     # 主测试文件
            │   ├── boundary.js  # 边界值测试（可选）
            │   └── {场景}.js    # 特殊场景测试（可选）
            ├── business.js      # 跨模块边界测试（可选）
            └── ...              # 其他模块
```

**目录结构规则**：

1. 每个业务模块独立成一个目录
2. `index.js` 存放该模块的主要测试用例
3. `boundary.js` 存放该模块的边界值容错测试（可选）
4. 特殊场景测试（如 logout-only）可单独成文件，命名为 `{场景}.js`
5. 跨模块的边界测试放在 modules 根目录
6. `context.js` 是全局上下文管理，所有测试模块通过它获取共享实例

### 3.4 npm scripts 配置

```json
{
  "scripts": {
    "test": "node test/api/runner.js",
    "test:auth": "node test/api/runner.js --module=auth"
  }
}
```

## 四、API 响应规范

### 4.1 统一响应格式

所有 API 接口必须遵循以下响应格式：

```javascript
{
  status: 'success' | 'error',  // 业务状态（非 HTTP 状态码）
  message: string,                // 提示信息
  datum: any                      // 成功时为业务数据，失败时为 null/undefined
}
```

### 4.2 status 字段定义规范（核心）

**核心原则**：

- success = 请求被后端正确处理并响应，无论返回数据是否为空
- error = 请求处理过程中遇到业务层面的问题（参数、权限、异常等）

**status: success 的场景**

| 场景               | status  | datum                           | 原因                                             |
| ------------------ | ------- | ------------------------------- | ------------------------------------------------ |
| 操作成功完成       | success | 业务数据                        | 请求被正确处理                                   |
| 列表查询为空       | success | { list: [], pagination: {...} } | 查询成功，只是没有数据                           |
| 查询不存在的 ID    | success | null                            | 查询成功，但结果为空（类似 SQL 查询返回 0 rows） |
| 登录成功           | success | { accessToken, ... }            | 认证成功                                         |
| 创建/更新/删除成功 | success | { success: true, id: xxx }      | 操作成功                                         |

**status: error 的场景**

| 场景                      | status | datum                | 原因                     |
| ------------------------- | ------ | -------------------- | ------------------------ |
| 参数缺失或格式错误        | error  | null                 | 业务层面的输入错误       |
| 参数验证失败              | error  | { errorList: [...] } | 业务规则不满足           |
| 权限不足                  | error  | null                 | 用户无权执行此操作       |
| 未登录                    | error  | null                 | 需要认证才能访问         |
| 资源不存在（更新/删除时） | error  | null                 | 尝试操作一个不存在的资源 |
| 资源冲突（如重复创建）    | error  | null                 | 业务约束冲突             |
| 服务器异常                | error  | null                 | 后端处理出错             |

**边界场景决策原则（严格更新模式）**

1. 查询类操作（GET）
   - 查不到数据 = success（datum 为空）
   - 用户意图是"看看有没有"，"没有"是有效的查询结果
   - 类比：SELECT \* FROM users WHERE id = 999999 → 返回空结果集，不是错误

2. 操作类操作（POST/PUT/DELETE）- 采用严格更新模式
   - 操作的目标不存在 = error
   - 用户意图是"修改/删除这个具体的数据"，数据不存在则操作失败
   - 类比：UPDATE users SET name = 'x' WHERE id = 999999 → 影响 0 rows，应报错
   - 更新不存在：error（"用户不存在"）
   - 删除不存在：error（"用户不存在"）

3. 列表查询
   - 空列表 = success（{ list: [], pagination: {...} }）
   - 分页超出范围 = success（返回空列表，不是错误）

**严格更新 vs 幂等更新**

| 模式     | 目标不存在 | 适用场景           | 示例                     |
| -------- | ---------- | ------------------ | ------------------------ |
| 严格更新 | error      | 资料修改、业务操作 | 修改用户昵称、扣减库存   |
| 幂等更新 | success    | 配置同步、状态设置 | 确保用户状态=1、配置同步 |

**本项目采用严格更新模式作为默认行为。**

### 4.3 响应处理规范

| 场景         | HTTP 状态码 | status 字段 | datum 值     | 前端处理                           |
| ------------ | ----------- | ----------- | ------------ | ---------------------------------- |
| 操作成功     | 200         | success     | 业务数据     | if (response.status === 'success') |
| 列表查询为空 | 200         | success     | { list: [] } | 正常处理空数组                     |
| 查询不存在   | 200         | success     | null         | 正常处理（"未找到"）               |
| 参数错误     | 200         | error       | null         | 显示 response.message              |
| 权限不足     | 200         | error       | null         | 显示 response.message / 跳转登录   |
| 服务器异常   | 200         | error       | null         | 显示 response.message              |

### 4.4 列表分页响应格式

```javascript
{
  status: 'success',
  message: '操作成功',
  datum: {
    list: [],           // 数据列表
    pagination: {       // 分页信息
      current_page: 1,  // 当前页码（从1开始）
      page_size: 20,    // 每页数量
      total: 100        // 总记录数
    }
  }
}
```

### 4.5 接口调用规范

入参规范：

- 所有接口通过 data（请求体）或 params（查询参数）传参
- 禁止使用 `/api/xxx/{id}` 路径参数
- 入参默认为数组，天然支持批量操作

示例：

```javascript
// 删除接口 - 支持单个和批量删除
POST /api/{module}/delete
Request: { data: [id1, id2, ...] }
```

## 五、API 调用预期验证规范（强制）

### 5.1 核心规则

**所有 API 调用必须显式声明预期结果，预期与实际不匹配时测试自动失败。**

### 5.2 expect 参数（必填）

```javascript
// 正确：显式声明预期
await apiClient.get(url, params, { expect: 'success' })
await apiClient.post(url, data, { expect: 'error' })

// 错误：不声明 expect
await apiClient.get(url, params) // 抛出错误：API 调用必须声明 expect 选项
```

### 5.3 expect 值定义

| 值        | 含义                          | 使用场景                           |
| --------- | ----------------------------- | ---------------------------------- |
| `success` | 预期 API 返回 status: success | 正常业务流程、增删改查成功         |
| `error`   | 预期 API 返回 status: error   | 参数校验失败、权限不足、资源不存在 |

### 5.4 测试用例写法

#### 正向测试（预期成功）

```javascript
test('查询用户列表 - 正常情况', async () => {
  await ensureLoggedIn()
  await apiClient.get('/user/list', null, { expect: 'success' })
})
```

#### 负向测试（预期失败）

```javascript
// 错误的旧写法（禁止）
test('创建用户 - 缺少必填字段', async () => {
  try {
    await apiClient.post('/user/create', { data: [{ real_name: 'xxx' }] })
    expect(true).to.equal(false)
  } catch (error) {
    expect(error).to.be.truthy()
  }
})

// 正确的新写法（必须）
test('创建用户 - 缺少必填字段', async () => {
  await apiClient.post(
    '/user/create',
    {
      data: [{ real_name: 'xxx' }]
    },
    { expect: 'error' }
  )
})
```

### 5.5 日志输出

```
[测试] 创建用户 - 缺少必填字段
  [请求] POST /user/create
  [预期] status: error
  [实际] status: error, message: 创建失败: 用户名和密码不能为空, 9ms
  [✓ 匹配]
[通过] 创建用户 - 缺少必填字段 (20ms)
```

### 5.6 禁止事项

- [禁止] API 调用不声明 expect 参数
- [禁止] 使用 try-catch 模板代码处理预期错误
- [禁止] expect 值写错（非 'success' 或 'error'）

### 5.7 必须使用

- [正确] 所有 API 调用必须声明 { expect: 'success' | 'error' }
- [正确] 正向测试使用 expect: 'success'
- [正确] 负向测试使用 expect: 'error'
- [正确] 预期不匹配时测试自动失败，框架自动处理

### 5.8 响应状态判定原则（核心约束）

**测试的本质是验证，不存在任何形式的"默认当作没问题"的概念。**

成功/通过/正确必须是明确验证后的结果。任何不确定、无法判定、不符合预期的情况，都必须被视为失败。

判定逻辑：

```javascript
// 正确判定（api-client.js）
if (data.status === 'success' || data.status === 'error') {
  actualStatus = data.status
} else if (data.success === true) {
  actualStatus = 'success'
} else if (data.success === false) {
  actualStatus = 'error'
} else {
  actualStatus = 'error' // 无法判定 = 失败
}
```

原因：

- 后端返回不符合规范的响应时，应该被测试检测出来
- 任何"乐观推断"都会掩盖潜在的 BUG，违背测试的根本目的
- 测试的态度是怀疑，不是信任

### 5.9 禁止事项

- [禁止] 响应格式无法判定时，设置 actualStatus = 'success'
- [禁止] 使用"默认通过"、"默认成功"、"默认正确"这类逻辑
- [禁止] 让不符合预期的响应静默通过测试
- [禁止] 省略验证步骤，假设返回值一定正确
- [禁止] 用 `else { /* 默认没问题 */ }` 这种写法
- [禁止] 在条件判断遗漏分支时不报错
- [禁止] 对不确定的状态返回"正常"、"有效"、"可用"等乐观推断

### 5.10 边界值容错测试（强制）

**核心原则**：每个 API 接口必须通过构造各种边界值、异常参数、不符合规范的入参来验证接口的容错能力。

测试必须覆盖以下场景：

| 测试类型     | 说明                                        | 示例                                                 |
| ------------ | ------------------------------------------- | ---------------------------------------------------- |
| **空值测试** | 参数为空、null、undefined、空字符串、空数组 | `{ data: [] }`, `{ name: '' }`, `{ id: null }`       |
| **类型错误** | 参数类型不匹配                              | `{ id: "string" }` 传数字, `{ age: "abc" }` 传字符串 |
| **长度边界** | 超长、过短、临界值                          | `{ name: 1个字符 }`, `{ name: 1000个字符 }`          |
| **范围边界** | 超出范围、负数、0                           | `{ page: -1 }`, `{ page: 999999 }`, `{ count: 0 }`   |
| **格式错误** | 邮箱、手机号、URL 格式错误                  | `{ email: "not-an-email" }`                          |
| **缺失参数** | 必填参数缺失                                | 不传 `username`, 不传 `data`                         |
| **多余参数** | 传入接口不需要的参数                        | `{ extra: "value" }`                                 |
| **特殊字符** | SQL 注入、XSS、Unicode 特殊字符             | `{ name: "'; DROP TABLE--" }`                        |
| **编码问题** | 非 ASCII 字符、乱码                         | `{ name: "😀🎉" }`, `{ name: "\\u0000" }`            |
| **组合异常** | 多个参数同时异常                            | 同时传空值和错误类型                                 |

#### 边界值测试示例

```javascript
// 示例 1: 创建用户接口的边界值测试
describe('用户管理 - 边界值容错测试', () => {
  // 空值测试
  test('创建用户 - 用户名为空字符串', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [{ user_name: '', password: 'password123' }]
      },
      { expect: 'error' }
    )
  })

  // 长度边界
  test('创建用户 - 用户名超长', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [{ user_name: 'a'.repeat(1000), password: 'password123' }]
      },
      { expect: 'error' }
    )
  })

  // 类型错误
  test('创建用户 - role_id 为字符串', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [{ user_name: 'test', password: 'password123', role_id: 'abc' }]
      },
      { expect: 'error' }
    )
  })

  // 范围边界
  test('查询用户列表 - page 为负数', async () => {
    await apiClient.get('/user/list', { current_page: -1, page_size: 10 }, { expect: 'error' })
  })

  test('查询用户列表 - page_size 超大', async () => {
    await apiClient.get('/user/list', { current_page: 1, page_size: 999999 }, { expect: 'error' })
  })

  // 特殊字符
  test('创建用户 - 用户名含 SQL 注入字符', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [{ user_name: "'; DROP TABLE users; --", password: 'password123' }]
      },
      { expect: 'error' }
    ) // 或者 success，取决于业务是否允许特殊字符
  })

  // Unicode 字符
  test('创建用户 - 用户名含 Emoji', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [{ user_name: 'user😀🎉', password: 'password123' }]
      },
      { expect: 'success' }
    ) // 应该允许正常 Unicode 字符
  })
})

// 示例 2: 登录接口的边界值测试
describe('认证模块 - 边界值容错测试', () => {
  test('登录 - 缺少用户名', async () => {
    await apiClient.post(
      '/auth/login',
      {
        password: 'password123'
      },
      { expect: 'error' }
    )
  })

  test('登录 - 缺少密码', async () => {
    await apiClient.post(
      '/auth/login',
      {
        username: 'admin'
      },
      { expect: 'error' }
    )
  })

  test('登录 - 用户名为空字符串', async () => {
    await apiClient.post(
      '/auth/login',
      {
        username: '',
        password: 'password123'
      },
      { expect: 'error' }
    )
  })

  test('登录 - 密码为空字符串', async () => {
    await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: ''
      },
      { expect: 'error' }
    )
  })

  test('登录 - 用户名含特殊字符', async () => {
    await apiClient.post(
      '/auth/login',
      {
        username: '<script>alert("xss")</script>',
        password: 'password123'
      },
      { expect: 'error' }
    ) // 或者 success，取决于业务
  })
})
```

#### 边界值测试覆盖要求

每个 API 接口必须覆盖的边界值场景：

| 参数类型 | 必须测试的边界值                                                 |
| -------- | ---------------------------------------------------------------- |
| 字符串   | 空、单字符、"null "、" undefined"、超长、特殊字符、SQL 注入、XSS |
| 数字     | 0、负数、极大值、非数字字符串                                    |
| 布尔值   | true、false、0、1、"true"、"false"                               |
| 数组     | 空、单元素、超长、元素类型错误                                   |
| 对象     | 空、缺失字段、多余字段、嵌套错误                                 |
| 枚举     | 无效值、边界值、大小写变体                                       |

#### Mock.js 构造边界值数据

使用 Mock.js 和手工方法构造边界值测试数据：

```javascript
const mock = require('mockjs')

// 边界值数据构造工具
const BoundaryData = {
  // 空值
  empty: () => ['', null, undefined, []],

  // 超长字符串
  longString: (length = 10000) => 'a'.repeat(length),

  // SQL 注入测试字符串
  sqlInjection: () => [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1' AND '1'='1",
    "admin'--",
    "' UNION SELECT * FROM users--"
  ],

  // XSS 测试字符串
  xss: () => [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<iframe src="javascript:alert(\'xss\')">',
    '"><script>alert(String.fromCharCode(88,83,83))</script>'
  ],

  // 特殊 Unicode 字符
  unicode: () => [
    '😀🎉🎊', // Emoji
    '\u0000', // NULL 字符
    '\u202E', // 从右到左覆盖字符
    '\uFEFF', // 零宽不换行空格
    '中文测试',
    'Ελληνικά', // 希腊语
    'العربية' // 阿拉伯语
  ],

  // 格式错误的值
  malformed: () => [
    { email: 'not-an-email' },
    { email: '@example.com' },
    { email: 'user@' },
    { phone: '123' },
    { phone: 'abcdefghij' },
    { phone: '+1234567890123456' }
  ],

  // 类型错误
  typeError: () => [
    { id: 'string-instead-of-number' },
    { count: 'nan' },
    { flag: 'yes-instead-of-boolean' },
    { date: 20230101 } // 错误的日期格式
  ]
}
```

#### 边界值测试禁止事项

- [禁止] 只测试正常场景，缺少边界值测试
- [禁止] 只覆盖 1-2 种边界情况，未全面覆盖
- [禁止] 假设前端会校验，后端就不测试异常输入
- [禁止] 使用"正常值 + 边界值"的简单组合，未单独测试每个边界
- [禁止] 忽略安全相关的边界值（SQL 注入、XSS 等）

## 六、测试模块设计

### 6.1 测试模块结构

每个模块遵循统一的结构：

```javascript
const { test, describe } = require('../lib/test-runner')
const { expect } = require('../lib/assertions')
const { getApiClient } = require('../context')

const apiClient = getApiClient()

describe('模块名称', () => {
  test('用例描述', async () => {
    // 测试逻辑
  })
})
```

### 6.2 测试模块执行顺序

1. 用户创建模块（生成全局测试数据）
2. 认证模块
3. 角色权限模块
4. 业务功能模块
5. **修改密码模块（最后执行）**

### 6.3 测试覆盖

每个 API 至少包含：

1. **正常场景** - 正确的参数，期望成功
2. **边界情况** - 空值、极限值等
3. **异常场景** - 错误的参数、不存在的资源等
4. **依赖异常** - 缺少前置条件、时序错误等

依赖异常测试示例：

- 未登录访问需要认证的接口 -> 验证返回 error
- 无权限访问需要特定角色的接口 -> 验证返回 error
- 传递不存在的关联 ID -> 验证参数错误
- Token 过期后继续请求 -> 验证自动刷新或返回 error

## 七、测试隔离与状态管理（重要）

### 7.1 状态污染问题

某些测试操作（如退出登录、重置密码）会改变全局状态，影响其他测试的执行。为了避免这种情况，必须采用测试隔离策略。

### 7.2 状态影响的测试类型

以下操作会影响全局状态，需要特殊处理：

| 操作类型 | 影响范围                                     | 隔离策略                |
| -------- | -------------------------------------------- | ----------------------- |
| 退出登录 | 注销当前 token，所有需要认证的接口将无法访问 | 使用独立 ApiClient 实例 |
| 重置密码 | 注销用户所有 session，需要重新登录           | 使用独立测试账户        |
| 删除资源 | 被删除的资源无法被后续测试使用               | 创建测试专用资源        |

### 7.3 测试隔离规范

#### 1. 使用独立的 ApiClient 实例

对于会影响全局状态的测试（如退出登录），必须创建独立的 ApiClient 实例：

```javascript
// 正确：使用独立 ApiClient 避免状态污染，数据由 Mock.js 动态生成
const mock = require('mockjs')

test('退出登录 - 完整流程测试', async () => {
  // 创建独立的 ApiClient 实例
  const testClient = createApiClient()

  // 动态生成测试账户数据
  const testAccount = {
    username: mock('@word'),
    password: mock('@string("lower", 8, 16)')
  }

  // 先登录
  const loginResponse = await testClient.post(
    '/auth/login',
    {
      username: testAccount.username,
      password: testAccount.password
    },
    { expect: 'success' }
  )
  const token = loginResponse.datum.accessToken
  testClient.setToken(token)

  // 验证可以访问
  await testClient.get('/auth/me', null, { expect: 'success' })

  // 退出登录
  await testClient.post('/auth/logout', null, { expect: 'success' })

  // 验证无法访问
  await testClient.get('/auth/me', null, { expect: 'error' })

  // 重新登录
  const reLoginResponse = await testClient.post(
    '/auth/login',
    {
      username: testAccount.username,
      password: testAccount.password
    },
    { expect: 'success' }
  )
  const newToken = reLoginResponse.datum.accessToken

  // 恢复主 apiClient 的状态
  apiClient.setToken(newToken)
  setAdminToken(newToken)
})
```

#### 2. 测试流程规范

对于会影响状态的测试，遵循以下流程：

```
1. 创建独立的 ApiClient 实例
2. 重新登录获取新的 token
3. 执行会影响状态的操作（如退出登录）
4. 验证操作结果
5. 重新登录恢复状态
6. 更新主 apiClient 的 token
```

#### 3. 独立测试账户

对于重置密码等会影响用户所有 session 的操作：

```javascript
// 使用专门的测试账户，数据由 Mock.js 动态生成
const mock = require('mockjs')

const TEST_ACCOUNTS = {
  resetPassword: {
    username: mock('@word'),
    password: mock('@string("lower", 8, 16)')
  },
  logout: {
    username: mock('@word'),
    password: mock('@string("lower", 8, 16)')
  }
}
```

### 7.4 禁止事项

- [禁止] 在会影响状态的测试中使用共享的 apiClient 实例
- [禁止] 在退出登录测试后不恢复 token 状态
- [禁止] 使用主测试账户进行重置密码测试
- [禁止] 硬编码测试账户数据（如 `username: 'admin', password: 'admin123'`），改密码后会导致后续测试失败
- [禁止] 共享同一测试账户进行会影响状态的测试

### 7.5 必须使用

- [正确] 状态影响测试使用独立 ApiClient 实例
- [正确] 测试结束后恢复共享状态（如更新主 apiClient 的 token）
- [正确] 重置密码等操作使用专门的测试账户
- [正确] 测试模块在 after 钩子中恢复环境

## 八、核心模块 API

### 8.1 进程管理器 (utils/process-manager.js)

| 方法                                 | 说明             |
| ------------------------------------ | ---------------- |
| findBackendProcess(port)             | 查找现有后端进程 |
| killProcess(pid, options)            | 终止进程         |
| startBackend(command, args, options) | 启动后端服务     |
| healthCheck(url, options)            | 健康检查         |

### 8.2 HTTP 客户端 (lib/api-client.js)

| 方法                     | 说明           |
| ------------------------ | -------------- |
| setToken(token)          | 设置认证 token |
| getToken()               | 获取认证 token |
| get(url, params, config) | GET 请求       |
| post(url, data, config)  | POST 请求      |
| put(url, data, config)   | PUT 请求       |
| delete(url, config)      | DELETE 请求    |

config 参数：

```javascript
{
  expect: 'success' | 'error' // 必填：预期结果
}
```

### 8.3 数据追踪器 (utils/data-tracker.js)

| 方法                | 说明               |
| ------------------- | ------------------ |
| startSession()      | 开始新的测试会话   |
| track(module, data) | 记录创建的数据     |
| get(module)         | 获取模块的测试数据 |
| getAll()            | 获取所有测试数据   |
| clear()             | 清空追踪记录       |

### 8.4 数据清理器 (utils/data-cleaner.js)

| 方法                    | 说明               |
| ----------------------- | ------------------ |
| setApiClient(client)    | 设置 API 客户端    |
| setDataTracker(tracker) | 设置数据追踪器     |
| cleanModule(module)     | 清理指定模块的数据 |
| cleanAll()              | 清理所有测试数据   |

### 8.5 测试运行器 (lib/test-runner.js)

| 函数                       | 说明           |
| -------------------------- | -------------- |
| describe(name, fn)         | 定义测试套件   |
| test(description, fn)      | 定义测试用例   |
| test.skip(description, fn) | 跳过测试       |
| test.only(description, fn) | 只运行此测试   |
| before(fn)                 | 所有测试前执行 |
| beforeEach(fn)             | 每个测试前执行 |
| after(fn)                  | 所有测试后执行 |

### 8.6 断言工具 (lib/assertions.js)

| 方法                               | 说明           |
| ---------------------------------- | -------------- |
| expect(actual).to.equal(expected)  | 相等断言       |
| expect(array).to.include(item)     | 包含断言       |
| expect(value).to.be.truthy()       | 真值断言       |
| expect(value).to.be.falsy()        | 假值断言       |
| expect(response).to.have.success() | API 成功断言   |
| expect(response).to.have.datum()   | API 有数据断言 |

## 九、使用示例

### 9.1 运行全部测试

```bash
cd server && node test/api/runner.js
```

### 9.2 运行单个模块

```bash
cd server && node test/api/runner.js --module=auth
```

### 9.3 命令行参数

```bash
node test/api/runner.js --module=auth    # 指定模块
node test/api/runner.js --verbose        # 详细输出
node test/api/runner.js --no-restart     # 不重启后端
```

## 十、验收标准

### 10.1 功能完整性

- 所有 API 端点都有对应的测试用例
- 每个 API 至少有 3 种测试场景（正常、边界、异常）
- 测试覆盖率达到 100%

### 10.2 稳定性

- 支持在不同环境运行
- 失败后有明确的错误信息
