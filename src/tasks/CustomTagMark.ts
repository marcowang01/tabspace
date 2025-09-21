import { Mark, markPasteRule } from '@tiptap/core'
import { nanoid } from 'nanoid'
import { CustomTag } from '../storage'

const TRANSPARENCY = "55"
const DEFAULT_COLOR = "#99999933"

export interface CustomTagMarkOptions {
  customTags: CustomTag[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customTagMark: {
      setCustomTag: (tagName: string) => ReturnType,
    }
  }
}

export const CustomTagMark = Mark.create<CustomTagMarkOptions>({
  name: 'customTagMark',
  exitable: true,
  keepOnSplit: false,

  addOptions() {
    return {
      customTags: []
    }
  },
  
  addAttributes() {
    return {
      tag: {
        default: '',
        parseHTML: element => element.getAttribute('data-custom-tag') || '',
        renderHTML: attributes => ({
          'data-custom-tag': attributes.tag,
          'title': `Tag: ${attributes.tag}`
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
          style: `background: ${attributes.color}${TRANSPARENCY}; padding: 0.15em 0.3em; border-radius: 5px; font-weight: 500;`
        })
      }
    }
  },

  addCommands() {
    return {
      setCustomTag:
        (tagName: string) => ({ commands }) => {
          const customTag = this.options.customTags.find(t => t.tag === tagName && t.enabled)
          if (!customTag) return false
          
          return commands.insertContent(`${tagName} `)
        },
    }
  },

  onCreate() {
    const transaction = this.editor.state.tr
    let changed = false
    
    // Build regex pattern from enabled custom tags
    const enabledTags = this.options.customTags.filter(tag => tag.enabled)
    if (enabledTags.length === 0) return
    
    const pattern = enabledTags
      .map(tag => tag.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi')
    
    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.text) {
        let match
        
        while ((match = regex.exec(node.text)) !== null) {
          const start = pos + match.index
          const end = start + match[0].length
          const tagText = match[0]
          
          // Find the matching custom tag
          const customTag = enabledTags.find(
            t => t.tag.toLowerCase() === tagText.toLowerCase()
          )
          if (!customTag) continue
          
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
              tag: customTag.tag,
              text: tagText,
              uid: nanoid(),
              color: customTag.color
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
    
    // Build regex pattern from enabled custom tags
    const enabledTags = this.options.customTags.filter(tag => tag.enabled)
    if (enabledTags.length === 0) return
    
    const pattern = enabledTags
      .map(tag => tag.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi')
    
    this.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.text) {
        let match
        
        while ((match = regex.exec(node.text)) !== null) {
          const start = pos + match.index
          const end = start + match[0].length
          const tagText = match[0]
          
          // Find the matching custom tag
          const customTag = enabledTags.find(
            t => t.tag.toLowerCase() === tagText.toLowerCase()
          )
          if (!customTag) continue
          
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
              tag: customTag.tag,
              text: tagText,
              uid: nanoid(),
              color: customTag.color
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

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-custom-tag]',
        getAttrs: dom => {
          const element = dom as HTMLElement
          const tagName = element.getAttribute('data-custom-tag')
          if (!tagName) return false
          
          const customTag = this.options.customTags.find(
            t => t.tag === tagName && t.enabled
          )
          if (!customTag) return false
          
          return {
            tag: tagName,
            text: element.innerText,
            color: customTag.color
          }
        },
      },
    ]
  },

  addPasteRules() {
    const enabledTags = this.options.customTags.filter(tag => tag.enabled)
    if (enabledTags.length === 0) return []
    
    const pattern = enabledTags
      .map(tag => tag.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    
    return [
      markPasteRule({
        find: new RegExp(`\\b(${pattern})\\b`, 'gi'),
        type: this.type,
        getAttributes: (match) => {
          const customTag = this.options.customTags.find(
            t => t.tag.toLowerCase() === match[0].toLowerCase() && t.enabled
          )
          return {
            tag: customTag?.tag || match[0],
            text: match[0],
            color: customTag?.color || DEFAULT_COLOR
          }
        }
      }),
    ]
  },
})