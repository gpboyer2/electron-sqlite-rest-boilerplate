# Electron SQLite REST Boilerplate

A desktop application template based on Electron + SQLite + REST API.

## Tech Stack

- **Electron** - Cross-platform desktop application framework
- **SQLite** (better-sqlite3) - Embedded database
- **Express** - REST API server
- **React** + **TypeScript** - Frontend framework
- **Vite** - Build tool and dev server

## Features

- Ready-to-use Electron project structure
- SQLite database integration with better-sqlite3
- RESTful API service built with Express
- React frontend with TypeScript support
- Hot reload development experience
- Cross-platform build support (Windows, macOS, Linux)

## Quick Start

### Requirements

- Node.js >= 18
- npm >= 9

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Build Application

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Build Multi-Architecture

```bash
# Windows 64-bit
npx electron-builder --win --x64

# macOS Apple Silicon
npx electron-builder --mac --arm64

# Linux 64-bit
npx electron-builder --linux --x64
```

## Project Structure

```
electron-sqlite-rest-boilerplate/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts
│   └── renderer/       # React frontend
├── resources/          # Application resources
└── package.json
```

## Acknowledgments

Frontend code is derived from [Kiro-account-manager](https://github.com/chaogei/Kiro-account-manager). We appreciate the author and the open source community.

## License

MIT
