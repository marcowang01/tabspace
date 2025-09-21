const fs = require('fs')
const path = require('path')

// This script watches the build directory and updates a timestamp file
// that the extension's background script can monitor for changes

const buildDir = path.join(__dirname, '..', 'build')
const reloadFile = path.join(buildDir, 'reload.txt')

console.log('🔄 Extension reload watcher started...')
console.log('📁 Watching build directory:', buildDir)

// Create initial reload file
function updateReloadFile() {
  try {
    fs.writeFileSync(reloadFile, Date.now().toString())
    console.log(`✅ Updated reload trigger at ${new Date().toLocaleTimeString()}`)
  } catch (error) {
    console.error('❌ Error updating reload file:', error)
  }
}

// Watch the build directory for changes
fs.watch(buildDir, { recursive: true }, (eventType, filename) => {
  // Ignore the reload.txt file itself and source maps
  if (filename === 'reload.txt' || filename?.endsWith('.map')) {
    return
  }
  
  // Debounce multiple rapid changes
  clearTimeout(global.reloadTimeout)
  global.reloadTimeout = setTimeout(() => {
    console.log(`📝 Detected change in: ${filename || 'build directory'}`)
    updateReloadFile()
  }, 500)
})

// Initial update
updateReloadFile()

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Stopping extension reload watcher...')
  process.exit(0)
})
