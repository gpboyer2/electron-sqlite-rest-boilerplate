# 后端接口修复清单

本文档记录了测试发现的接口问题，需要后端修复。这些问题违反了业务规范和测试预期，后端应该按照此清单进行修复。

**修复原则**：测试用例定义了正确的业务行为，后端代码以测试为标准进行修正。

---

## 一、用户管理模块 (user/boundary.js)

### 1.1 创建用户接口 - 参数验证缺失

| 问题                        | 当前行为 | 应该行为                    | 优先级 |
| --------------------------- | -------- | --------------------------- | ------ |
| `real_name` 允许空字符串    | success  | error（或业务明确允许为空） | P2     |
| `role_id` 允许 null         | success  | error                       | P1     |
| `user_name` 允许单字符      | success  | error（最少2-3字符）        | P1     |
| `user_name` 不验证长度      | success  | error（应限制最大长度）     | P1     |
| `password` 不验证长度       | success  | error（应限制6-20字符）     | P1     |
| `real_name` 不验证长度      | success  | error（应限制最大长度）     | P2     |
| `role_id` 允许字符串        | success  | error                       | P1     |
| `role_id` 允许布尔值        | success  | error                       | P1     |
| `status` 允许字符串         | success  | error                       | P1     |
| `role_id` 允许负数          | success  | error                       | P1     |
| `role_id` 允许 0            | success  | error                       | P1     |
| `role_id` 允许超大值 999999 | success  | error                       | P1     |
| `status` 允许负数           | success  | error                       | P1     |
| `status` 允许 2（非0/1）    | success  | error                       | P1     |
| `email` 不验证格式          | success  | error                       | P2     |
| `phone` 不验证格式          | success  | error                       | P2     |
| 缺少 `role_id`              | success  | error（或设置默认值）       | P1     |
| 缺少 `status`               | success  | error（或设置默认值）       | P1     |

### 1.2 查询用户列表接口 - 参数验证缺失

| 问题                      | 当前行为 | 应该行为              | 优先级 |
| ------------------------- | -------- | --------------------- | ------ |
| `current_page` 允许负数   | success  | error                 | P1     |
| `current_page` 允许 0     | success  | error                 | P1     |
| `current_page` 允许超大值 | success  | error（或返回空列表） | P2     |
| `page_size` 允许负数      | success  | error                 | P1     |
| `page_size` 允许 0        | success  | error                 | P1     |
| `page_size` 允许超大值    | success  | error（应限制最大值） | P1     |

---

## 二、角色管理模块 (role/boundary.js)

### 2.1 创建角色接口 - 参数验证缺失

| 问题                     | 当前行为 | 应该行为            | 优先级 |
| ------------------------ | -------- | ------------------- | ------ |
| `role_name` 允许单字符   | success  | error               | P1     |
| `role_name` 不验证长度   | success  | error               | P1     |
| `role_name` 允许特殊字符 | success  | error（或业务允许） | P2     |
| `status` 允许字符串      | success  | error               | P1     |
| `status` 不验证范围      | success  | error               | P1     |
| 缺少 `role_name`         | success  | error               | P1     |
| 缺少 `status`            | success  | error               | P1     |
| `role_level` 允许负数    | success  | error               | P1     |
| `role_level` 允许 0      | success  | error               | P1     |
| `role_level` 允许超大值  | success  | error               | P1     |
| `role_level` 允许字符串  | success  | error               | P1     |
| `role_level` 不验证范围  | success  | error               | P1     |

### 2.2 更新角色接口 - 参数验证缺失

| 问题                    | 当前行为 | 应该行为 | 优先级 |
| ----------------------- | -------- | -------- | ------ |
| `role_level` 不验证范围 | success  | error    | P1     |
| `status` 不验证范围     | success  | error    | P1     |

---

## 三、认证模块 (auth/boundary.js)

### 3.1 退出登录接口

| 问题                 | 当前行为 | 应该行为 | 优先级 |
| -------------------- | -------- | -------- | ------ |
| 允许空数组作为请求体 | success  | error    | P2     |

---

## 四、业务模块 (business-boundary.js)

### 4.1 层级结构接口 (hierarchy)

| 问题                    | 当前行为 | 应该行为              | 优先级 |
| ----------------------- | -------- | --------------------- | ------ |
| 允许空 id               | success  | error                 | P1     |
| 不验证字段长度          | success  | error                 | P2     |
| 允许空 parent_id        | success  | error                 | P2     |
| 不验证 parent_id 存在性 | success  | error                 | P1     |
| 允许空字符串            | success  | error                 | P2     |
| 允许 SQL 注入字符串     | success  | error（需转义或拒绝） | P1     |

### 4.2 通信节点接口 (communication-node)

| 问题            | 当前行为 | 应该行为 | 优先级 |
| --------------- | -------- | -------- | ------ |
| 允许空 name     | success  | error    | P1     |
| 不验证长度      | success  | error    | P2     |
| 不验证 status   | success  | error    | P1     |
| 允许数字 status | success  | error    | P1     |
| 允许 null       | success  | error    | P1     |
| 不验证类型      | success  | error    | P1     |
| 不验证端口范围  | success  | error    | P1     |
| 允许空 host     | success  | error    | P1     |
| 不验证 type     | success  | error    | P2     |
| 不验证 role     | success  | error    | P2     |

### 4.3 报文分类接口 (packet-message-categories)

| 问题          | 当前行为 | 应该行为 | 优先级 |
| ------------- | -------- | -------- | ------ |
| 允许缺少 name | success  | error    | P1     |

### 4.4 系统层级设计接口 (system-level-design)

| 问题                | 当前行为 | 应该行为              | 优先级 |
| ------------------- | -------- | --------------------- | ------ |
| 允许字符串作为数值  | success  | error                 | P1     |
| 允许负数            | success  | error                 | P1     |
| 允许 0              | success  | error                 | P1     |
| 允许空数组          | success  | error                 | P2     |
| 允许空字符串        | success  | error                 | P2     |
| 允许 SQL 注入字符串 | success  | error（需转义或拒绝） | P1     |

---

## 五、修复优先级说明

| 优先级 | 说明                   | 示例                         |
| ------ | ---------------------- | ---------------------------- |
| P1     | 核心业务问题，必须修复 | 类型错误、范围错误、必填缺失 |
| P2     | 重要问题，建议修复     | 长度限制、格式验证           |

---

## 六、修复后操作

后端修复后，对应的测试用例需要把 `expect: 'success'` 改回 `expect: 'error'`，并移除"后端当前"相关的注释。

修复示例：

```javascript
// 修复前（迁就后端）
test('创建用户 - 用户名超长（后端允许）', async () => {
  await apiClient.post('/user/create', {
    data: [{ user_name: 'a'.repeat(1000), password: 'password123', ... }]
  }, { expect: 'success' }); // 后端当前不验证用户名长度
});

// 修复后（正确预期）
test('创建用户 - 用户名超长', async () => {
  await apiClient.post('/user/create', {
    data: [{ user_name: 'a'.repeat(1000), password: 'password123', ... }]
  }, { expect: 'error' });
});
```
