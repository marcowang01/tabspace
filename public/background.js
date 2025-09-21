// Hot reload functionality for development
// This will only work when reload.txt exists (created by the watch script)
let lastReloadTime = 0

setInterval(async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('reload.txt'))
    if (response.ok) {
      const timestamp = await response.text()
      const currentTime = parseInt(timestamp)
      
      if (currentTime > lastReloadTime && lastReloadTime !== 0) {
        console.log('🔄 Reloading extension due to file changes...')
        chrome.runtime.reload()
      }
      
      lastReloadTime = currentTime
    }
  } catch (error) {
    // Ignore errors - reload.txt might not exist in production
  }
}, 2000)

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-tabspace') {
    // Open TabSpace in a new tab or focus existing tab
    openTabSpace()
  }
})

// Function to open TabSpace
async function openTabSpace() {
  // Get the extension URL
  const extensionUrl = chrome.runtime.getURL('index.html')
  
  // Check if TabSpace is already open in any tab
  const tabs = await chrome.tabs.query({})
  const existingTab = tabs.find(tab => tab.url === extensionUrl)
  
  if (existingTab) {
    // If TabSpace is already open, focus that tab
    await chrome.tabs.update(existingTab.id, { active: true })
    await chrome.windows.update(existingTab.windowId, { focused: true })
  } else {
    // Otherwise, create a new tab with TabSpace
    await chrome.tabs.create({ url: extensionUrl })
  }
}

// Optional: Add a browser action (toolbar button) to open TabSpace
// This requires adding "action": {} to manifest.json
chrome.action?.onClicked?.addListener(() => {
  openTabSpace()
})
