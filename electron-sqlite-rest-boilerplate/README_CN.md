# Electron Sqlite REST Boilerplate

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="App Logo">
</p>

<p align="center">
  <strong>Electron + SQLite + REST API 桌面应用开发样板</strong>
</p>

<p align="center">
  基于 Electron + React + TypeScript + SQLite 构建的桌面应用开发样板
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

---

## 功能特性

### 技术栈

- **Electron** - 跨平台桌面应用框架
- **React** - 前端 UI 框架
- **TypeScript** - 类型安全
- **SQLite** - 本地数据存储
- **REST API** - 后端接口

### 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建应用
npm run build
```

### 项目结构

```
electron-sqlite-rest-boilerplate/
├── src/
│   ├── main/          # Electron 主进程
│   ├── preload/       # 预加载脚本
│   └── renderer/      # React 前端
├── resources/         # 应用资源
└── build/             # 构建配置
```

### 打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

---

## 许可证

MIT
