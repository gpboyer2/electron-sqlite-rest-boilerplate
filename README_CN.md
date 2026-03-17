# Electron SQLite REST Boilerplate

一个基于 Electron + SQLite + REST API 的桌面应用模板项目。

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **SQLite** (better-sqlite3) - 嵌入式数据库
- **Express** - REST API 服务器
- **React** + **TypeScript** - 前端框架
- **Vite** - 构建工具和开发服务器

## 特性

- 开箱即用的 Electron 项目结构
- SQLite 数据库集成（better-sqlite3）
- Express 构建的 RESTful API 服务
- React 前端，支持 TypeScript
- 热重载开发体验
- 跨平台构建支持（Windows、macOS、Linux）

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 构建多架构版本

```bash
# Windows 64位
npx electron-builder --win --x64

# macOS Apple Silicon
npx electron-builder --mac --arm64

# Linux 64位
npx electron-builder --linux --x64
```

## 项目结构

```
electron-sqlite-rest-boilerplate/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 预加载脚本
│   └── renderer/       # React 前端
├── resources/          # 应用资源
└── package.json
```

## 致谢

前端代码基于 [Kiro-account-manager](https://github.com/chaogei/Kiro-account-manager) 改编，感谢作者及开源社区。

## 许可证

MIT
