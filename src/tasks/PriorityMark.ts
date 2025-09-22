import { Mark, markPasteRule } from '@tiptap/core'
import { nanoid } from 'nanoid'

export interface PriorityMarkOptions {
  HTMLAttributes: Record<string, any>,
}

const TRANSPARENCY = "55"
const P0_COLOR = "#ff0000" + TRANSPARENCY  // Critical - Red
const P1_COLOR = "#ff6600" + TRANSPARENCY  // High - Orange
const P2_COLOR = "#ffaa00" + TRANSPARENCY  // Medium - Yellow-Orange
const P3_COLOR = "#ffff00" + TRANSPARENCY  // Low - Yellow
const P4_COLOR = "#00aa00" + TRANSPARENCY  // Very Low - Green
const DEFAULT_COLOR = "#99999933"          // Default - Gray

function calculatePriorityColor(priority: string): string {
  const match = priority.match(/^p(\d+)$/i)
  if (!match) return DEFAULT_COLOR
  
  const level = parseInt(match[1])
  switch(level) {
    case 0: return P0_COLOR
    case 1: return P1_COLOR
    case 2: return P2_COLOR
    case 3: return P3_COLOR
    case 4: return P4_COLOR
    default: 
      // For p5+ use increasingly lighter greens
      if (level >= 5) {
        return "#00cc00" + TRANSPARENCY
      }
      return DEFAULT_COLOR
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    priorityMark: {
      setPriority: (level: number) => ReturnType,
    }
  }
}

export const PriorityMark = Mark.create({
  name: 'priorityMark',
  exitable: true,
  keepOnSplit: false,
  
  addAttributes() {
    return {
      priority: {
        default: '',
        parseHTML: element => element.getAttribute('data-priority') || '',
        renderHTML: attributes => ({
          'data-priority': attributes.priority,
          'title': `Priority: ${attributes.priority.toUpperCase()}`
        })
      },
      text: {
        default: '',
        parseHTML: element => element.innerText,
      },
      uid: {
        default: nanoid(),
        renderHTML: attributes => ({
          id: attributes.uid
        })
      },
      color: {
        default: DEFAULT_COLOR,
        renderHTML: attributes => ({
          style: `background: ${attributes.color};`
        })
      }
    }
  },

  addCommands() {
    return {
      setPriority: (level: number = 1) => ({commands}) => {
        const priority = `p${level}`
        commands.setMark(this.name, { 
          priority,
          text: priority,
          color: calculatePriorityColor(priority)
        })
        return commands.insertContent(`${priority} `)
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-p': () => this.editor.commands.setPriority(0),
      'Mod-P': () => this.editor.commands.setPriority(0),
    }
  },

  onCreate() {
    const transaction = this.editor.state.tr
    let changed = false
    
    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.text) {
        // Find all priority patterns that are complete words
        const regex = /\b(p\d+)\b/gi
        let match
        
        while ((match = regex.exec(node.text)) !== null) {
          const start = pos + match.index
          const end = start + match[0].length
          const priority = match[1].toLowerCase()
          
          // Check if this range already has our mark
          let hasOurMark = false
          this.editor.state.doc.nodesBetween(start, end, (node) => {
            if (node.marks.some(mark => mark.type.name === this.name)) {
              hasOurMark = true
            }
          })
          
          // Only add mark if it doesn't already have one
          if (!hasOurMark) {
            const mark = this.type.create({
              priority,
              text: match[0],
              uid: nanoid(),
              color: calculatePriorityColor(priority)
            })
            transaction.addMark(start, end, mark)
            changed = true
          }
        }
      }
    })
    
    if (changed) {
      this.editor.view.dispatch(transaction)
    }
  },

  onUpdate() {
    const transaction = this.editor.state.tr
    let changed = false
    
    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.text) {
        // Find all priority patterns that are complete words
        const regex = /\b(p\d+)\b/gi
        let match
        
        while ((match = regex.exec(node.text)) !== null) {
          const start = pos + match.index
          const end = start + match[0].length
          const priority = match[1].toLowerCase()
          
          // Check if this range already has our mark
          let hasOurMark = false
          this.editor.state.doc.nodesBetween(start, end, (node) => {
            if (node.marks.some(mark => mark.type.name === this.name)) {
              hasOurMark = true
            }
          })
          
          // Only add mark if it doesn't already have one
          if (!hasOurMark) {
            const mark = this.type.create({
              priority,
              text: match[0],
              uid: nanoid(),
              color: calculatePriorityColor(priority)
            })
            transaction.addMark(start, end, mark)
            changed = true
          }
        }
      }
    })
    
    if (changed) {
      transaction.setMeta('addToHistory', false)
      transaction.setMeta('preventUpdate', true)
      this.editor.view.dispatch(transaction)
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-priority]',
      },
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /\b(p\d+)\b/gi,
        type: this.type,
        getAttributes: (match) => {
          const priority = match[0].toLowerCase()
          return {
            priority,
            text: match[0],
            color: calculatePriorityColor(priority)
          }
        }
      }),
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      HTMLAttributes,
      0,
    ]
  },
})