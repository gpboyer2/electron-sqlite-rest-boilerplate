const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'src', 'main', 'server')
const targetDir = path.join(projectRoot, 'out', 'main', 'server')

const ignoredSegments = new Set([
  '.DS_Store',
  '.env',
  '.env.test',
  'client',
  'logs',
  'temp',
  'test'
])

function shouldCopy(sourcePath) {
  const relativePath = path.relative(sourceDir, sourcePath)
  if (!relativePath || relativePath.startsWith('..')) {
    return true
  }

  const segments = relativePath.split(path.sep)
  if (segments.some((segment) => ignoredSegments.has(segment))) {
    return false
  }

  return !/\.db($|[._-])/.test(relativePath)
}

function copyDirectory(sourcePath, destinationPath) {
  if (!shouldCopy(sourcePath)) {
    return
  }

  const stats = fs.statSync(sourcePath)
  if (stats.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true })
    for (const entry of fs.readdirSync(sourcePath)) {
      copyDirectory(path.join(sourcePath, entry), path.join(destinationPath, entry))
    }
    return
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  fs.copyFileSync(sourcePath, destinationPath)
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Server source directory not found: ${sourceDir}`)
}

fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
copyDirectory(sourceDir, targetDir)

console.log(`[copy-server] Copied server assets to ${targetDir}`)
