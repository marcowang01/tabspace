#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log(`
╔════════════════════════════════════════════════════════════╗
║                TabSpace Hot Reload Setup                   ║
╚════════════════════════════════════════════════════════════╝

This script will set up hot reload for your Chrome extension development.

Features:
✨ Automatic rebuild on file changes
⏱️  1.5 second debounce to prevent excessive rebuilds  
🔄 Automatic extension reload in Chrome
🚀 Optimized for fast development

`)

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
  console.log('📦 Installing dependencies...')
  try {
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log('✅ Dependencies installed successfully!\n')
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message)
    process.exit(1)
  }
} else {
  console.log('✅ Dependencies already installed\n')
}

// Build the extension once
console.log('🔨 Building extension...')
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  console.log('✅ Initial build complete!\n')
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║                   Setup Instructions                       ║
╚════════════════════════════════════════════════════════════╝

1️⃣  Load the extension in Chrome:
   • Open Chrome and go to chrome://extensions/
   • Enable "Developer mode" (top right)
   • Click "Load unpacked"
   • Select the 'build' directory from this project

2️⃣  Start the hot reload watcher:
   Run: npm run watch:dev

3️⃣  Start developing!
   • Edit any file in 'src' or 'public'
   • The extension will automatically rebuild after 1.5 seconds
   • Chrome will reload the extension automatically

╔════════════════════════════════════════════════════════════╗
║                     Available Scripts                      ║
╚════════════════════════════════════════════════════════════╝

📍 npm run watch       - Watch and rebuild only
📍 npm run watch:dev   - Watch, rebuild, and auto-reload extension
📍 npm run build       - Build once (production)
📍 npm run dev         - Start React dev server (for testing UI)

╔════════════════════════════════════════════════════════════╗
║                         Tips                               ║
╚════════════════════════════════════════════════════════════╝

💡 The 1.5 second delay prevents excessive rebuilds when saving multiple files
💡 Check the console in background page for reload logs
💡 If auto-reload stops working, manually reload the extension once
💡 Use Cmd+R (Mac) or Ctrl+R (Windows/Linux) to manually reload if needed

Happy coding! 🚀
`)

// Offer to start the watcher
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('\n🤔 Would you like to start the hot reload watcher now? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n🚀 Starting hot reload watcher...\n')
    rl.close()
    
    // Start the watcher
    require('child_process').spawn('npm', ['run', 'watch:dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    })
  } else {
    console.log('\n👍 You can start the watcher later with: npm run watch:dev')
    rl.close()
  }
})
