# CSSC Node-View 服务端

## 项目简介

体系级全流程设计系统的后端服务，提供 RESTful API 和 WebSocket 服务。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **通信**: Socket.IO, NATS
- **日志**: log4js
- **文档**: Swagger

## 开发模式

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
# 开发模式
npm run node:dev

# 生产模式
npm run node:prod

# 使用 PM2 管理
npm run pm2:dev
npm run pm2:prod
```

### 访问服务

- **HTTP API**: http://localhost:9200
- **WebSocket**: ws://localhost:9210
- **API 文档**: http://localhost:9200/api-docs

## 生产部署

### 方式一：打包为独立可执行文件（推荐）

使用 `pkg` 工具将 Node.js 应用打包为独立的可执行文件，**无需安装 Node.js、npm 或任何依赖包**。

#### 打包所有平台

```bash
npm run dist
```

生成文件：

- `dist/seasaver_server-win.exe` (Windows)
- `dist/seasaver_server-macos` (macOS)
- `dist/seasaver_server-linux` (Linux)

#### 打包单个平台

```bash
# 仅打包 Linux 版本
npm run dist:linux

# 仅打包 Windows 版本
npm run dist:win

# 仅打包 macOS 版本
npm run dist:mac
```

#### Linux 服务器部署步骤

1. **打包应用**

```bash
# 在开发机器上打包
npm run dist:linux
```

2. **上传到服务器**

```bash
# 上传可执行文件
scp dist/seasaver_server-linux user@server:/opt/cssc-node-view/

# 上传配置文件（如果有）
scp -r config user@server:/opt/cssc-node-view/
scp -r data user@server:/opt/cssc-node-view/
```

3. **设置执行权限**

```bash
ssh user@server
cd /opt/cssc-node-view
chmod +x seasaver_server-linux
```

4. **直接运行**

```bash
# 前台运行
./seasaver_server-linux

# 后台运行
nohup ./seasaver_server-linux > server.log 2>&1 &
```

5. **配置系统服务（可选）**

创建 systemd 服务文件 `/etc/systemd/system/cssc-node-view.service`：

```ini
[Unit]
Description=CSSC Node-View Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/cssc-node-view
ExecStart=/opt/cssc-node-view/seasaver_server-linux
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/cssc-node-view/server.log
StandardError=append:/var/log/cssc-node-view/error.log

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cssc-node-view
sudo systemctl start cssc-node-view
sudo systemctl status cssc-node-view
```

### 方式二：传统 Node.js 部署

如果服务器已安装 Node.js，可以使用传统方式部署：

```bash
# 上传代码
scp -r server user@server:/opt/cssc-node-view/

# 服务器上安装依赖
ssh user@server
cd /opt/cssc-node-view/server
npm install --production

# 启动服务
npm run node:prod
```

## 打包配置说明

### pkg.json 配置

```json
{
  "pkg": {
    "scripts": ["server.js", "**/*.js"],
    "assets": [
      "database/*.db",
      "config/**/*",
      "static/**/*",
      "node_modules/better-sqlite3/lib/binding/*.node"
    ],
    "targets": ["node18-win-x64", "node18-macos-x64", "node18-linux-x64"]
  }
}
```

### 原生模块处理

项目包含以下原生模块，已在打包配置中正确处理：

- **better-sqlite3**: SQLite 数据库驱动（原生 .node 文件）
- **bcrypt**: 密码加密库（原生模块）

这些模块的原生二进制文件会自动包含在打包后的可执行文件中。

## 环境变量配置

可通过环境变量或配置文件 `etc/config.js` 修改服务配置：

```javascript
module.exports = {
  VITE_API_HOST: process.env.HTTP_HOST || '0.0.0.0',
  VITE_API_PORT: process.env.VITE_API_PORT || 9200,
  VITE_WS_HOST: process.env.WS_HOST || '0.0.0.0',
  VITE_WS_PORT: process.env.VITE_WS_PORT || 9210,
  QT_SERVER_HOST: process.env.QT_HOST || 'localhost',
  QT_SERVER_PORT: process.env.QT_PORT || 8080
}
```

### 环境变量命名说明（VITE\_ 前缀）

后端配置使用 `VITE_*` 前缀的环境变量，这是有意的设计决策，原因如下：

- **前后端共享配置**：容器运行时通过 VITE 注入同一套变量到前端，后端读取相同变量保持一致
- **减少配置冗余**：避免维护 `API_PORT` 和 `VITE_API_PORT` 两套配置，降低出错风险
- **部署简化**：Docker 容器只需设置一套环境变量即可

因此后端读取 `VITE_API_PORT`、`VITE_WS_PORT` 等变量是正常行为，并非配置错误。

### 达梦数据库配置

系统支持通过环境变量控制是否启用达梦数据库连接：

```javascript
// 达梦数据库开关（默认禁用）
const ENABLE_DM_DB = process.env.ENABLE_DM_DB === '1'
```

#### 默认行为（推荐）

- 不设置 `ENABLE_DM_DB` 环境变量时，系统仅使用 SQLite 数据库
- 不会创建达梦连接池，不会产生任何达梦相关的日志或警告

#### 启用达梦数据库

如需在特定环境中使用达梦数据库，可通过以下方式启用：

- Linux/macOS:

  ```bash
  ENABLE_DM_DB=1 node server.js
  # 或写入 npm 脚本
  ```

- Windows:
  ```bat
  set ENABLE_DM_DB=1 && node server.js
  ```

#### 使用建议

- **开发/测试环境**：保持默认状态（禁用达梦），仅使用 SQLite
- **生产环境**：仅在确认网络、达梦实例、账号配置正确后启用达梦
- **代码规范**：
  - 系统管理/报文/流程图等模块禁止引用达梦工具

## 日志管理

日志文件位置：`logs/`

- `access.log` - 访问日志
- `error.log` - 错误日志
- `app.log` - 应用日志

## API 接口

### 核心接口路由

- `/hierarchy` - 层级配置接口
- `/system-level-design-tree` - 体系配置树节点接口
- `/packet-messages` - 报文配置管理接口
- `/packet-message-categories` - 报文分类管理接口
- `/flowcharts` - 流程图接口
- `/test` - 测试接口
- `/user` - 用户接口
- `/auth` - 认证接口
- `/roles` - 角色接口
- `/permissions` - 权限接口
- `/log` - 日志接口
- `/topology` - 拓扑展示接口
- `/database` - 数据库管理接口
- `/communication-nodes` - 通信节点接口

详细接口文档请访问：http://localhost:9200/api-docs

## 故障排查

### 端口被占用

```bash
# 查看端口占用
lsof -i :9200
netstat -tunlp | grep 9200

# 修改配置文件中的端口
vim etc/config.js
```

### 数据库文件权限

```bash
# 确保数据库文件可读写
chmod 644 database/*.db
chown www-data:www-data database/*.db
```

### 查看服务日志

```bash
# systemd 服务日志
sudo journalctl -u cssc-node-view -f

# 应用日志
tail -f logs/app.log
tail -f logs/error.log
```

## 性能优化建议

1. **使用反向代理**: 在生产环境使用 Nginx 作为反向代理
2. **启用 GZIP 压缩**: 减少网络传输数据量
3. **配置进程管理**: 使用 systemd 或 PM2 管理进程
4. **定期清理日志**: 避免日志文件过大
5. **数据库优化**: 定期执行 VACUUM 优化 SQLite 数据库

## 安全建议

1. **修改默认端口**: 避免使用常见端口
2. **配置防火墙**: 限制访问 IP 范围
3. **启用 HTTPS**: 配置 SSL 证书
4. **定期更新**: 保持依赖包版本更新
5. **备份数据**: 定期备份数据库文件

## 许可协议

ISC License
