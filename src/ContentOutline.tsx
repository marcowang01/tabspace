import React, { useState, useEffect, useMemo } from 'react'
import { Editor } from '@tiptap/core'
import { JSONContent } from '@tiptap/react'
import './ContentOutline.css'

interface OutlineItem {
  id: string
  type: 'heading' | 'task' | 'paragraph' | 'listItem'
  level: number
  text: string
  priority?: number
  position: number
  children: OutlineItem[]
}

interface ContentOutlineProps {
  editor: Editor | null
}

const extractPriority = (text: string): number | undefined => {
  const match = text.match(/\bp(\d+)\b/i)
  return match ? parseInt(match[1]) : undefined
}

const extractTextFromNode = (node: JSONContent): string => {
  if (node.type === 'text') {
    return node.text || ''
  }
  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }
  return ''
}

const buildOutlineTree = (doc: JSONContent): OutlineItem[] => {
  const items: OutlineItem[] = []
  let currentSection: OutlineItem | null = null
  const sectionStack: OutlineItem[] = []
  const positionMap = new Map<number, number>() // Maps our position counter to actual document position
  let nodeCounter = 0
  let docPos = 0

  const calculateNodeSize = (node: JSONContent): number => {
    // Calculate the size of a node in the ProseMirror document
    if (node.type === 'text') {
      return node.text?.length || 0
    }
    let size = 1 // Opening tag
    if (node.content) {
      for (const child of node.content) {
        size += calculateNodeSize(child)
      }
    }
    size += 1 // Closing tag
    return size
  }

  const processNode = (node: JSONContent, skipContent: boolean = false) => {
    nodeCounter++
    const currentDocPos = docPos
    positionMap.set(nodeCounter, currentDocPos)
    
    if (node.type === 'heading') {
      const text = extractTextFromNode(node)
      const level = node.attrs?.level || 1
      const newSection: OutlineItem = {
        id: `heading-${nodeCounter}`,
        type: 'heading',
        level,
        text,
        position: currentDocPos,
        children: []
      }
      
      // Pop sections from stack until we find the right parent level
      while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
        sectionStack.pop()
      }
      
      if (sectionStack.length > 0) {
        // Add to parent section
        sectionStack[sectionStack.length - 1].children.push(newSection)
      } else {
        // Add to root
        items.push(newSection)
      }
      
      sectionStack.push(newSection)
      currentSection = newSection
      
    } else if (node.type === 'taskList' || node.type === 'bulletList') {
      // Process list items but don't add the list container itself
      if (node.content) {
        docPos++ // List opening
        node.content.forEach(child => {
          processNode(child)
          docPos += calculateNodeSize(child)
        })
        docPos++ // List closing
      }
      return // Don't process content again
      
    } else if (node.type === 'taskItem' || node.type === 'listItem') {
      const text = extractTextFromNode(node)
      const priority = extractPriority(text)
      
      if (text.trim()) {
        const item: OutlineItem = {
          id: `item-${nodeCounter}`,
          type: node.type === 'taskItem' ? 'task' : 'listItem',
          level: 0,
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          priority,
          position: currentDocPos,
          children: []
        }
        
        if (currentSection) {
          currentSection.children.push(item)
        } else {
          items.push(item)
        }
      }
      // Don't process taskItem/listItem content as it's already extracted above
      return
      
    } else if (node.type === 'paragraph' && !skipContent) {
      const text = extractTextFromNode(node)
      const priority = extractPriority(text)
      
      if (text.trim()) {
        const item: OutlineItem = {
          id: `item-${nodeCounter}`,
          type: 'paragraph',
          level: 0,
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          priority,
          position: currentDocPos,
          children: []
        }
        
        if (currentSection) {
          currentSection.children.push(item)
        } else {
          items.push(item)
        }
      }
    }
    
    // Only process content if we haven't already handled it above
    if (!skipContent && node.content && node.type !== 'taskItem' && node.type !== 'listItem' && node.type !== 'taskList' && node.type !== 'bulletList') {
      if (node.content) {
        docPos++ // Node opening
        node.content.forEach(child => {
          processNode(child)
          docPos += calculateNodeSize(child)
        })
        docPos++ // Node closing
      }
    }
  }
  
  if (doc.content) {
    doc.content.forEach(node => {
      processNode(node)
      docPos += calculateNodeSize(node)
    })
  }
  
  return items
}

const ContentOutline: React.FC<ContentOutlineProps> = ({ editor }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [content, setContent] = useState<JSONContent | null>(null)

  useEffect(() => {
    if (!editor) return

    const updateContent = () => {
      setContent(editor.getJSON())
    }

    updateContent()
    editor.on('update', updateContent)
    
    return () => {
      editor.off('update', updateContent)
    }
  }, [editor])

  const outlineItems = useMemo(() => {
    if (!content) return []
    return buildOutlineTree(content)
  }, [content])


  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const scrollToPosition = (position: number) => {
    if (!editor) return
    
    try {
      // Get the view and scroll the position into view with some offset
      // Note: We don't focus the editor to avoid affecting the outline display
      const view = editor.view
      const coords = view.coordsAtPos(position)
      const editorElement = view.dom
      const rect = editorElement.getBoundingClientRect()
      
      // Calculate scroll position with a bit of offset from top
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const targetScroll = coords.top + scrollTop - rect.top - 100 // 100px offset from top
      
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      })
    } catch (error) {
      // Fallback to simpler approach if position is out of bounds
      console.warn('Position out of bounds, using fallback navigation', error)
      
      // Try to find the closest valid position and scroll to it
      let foundPos = -1
      let nodeIndex = 0
      
      editor.state.doc.descendants((node, pos) => {
        if (Math.abs(pos - position) < Math.abs(foundPos - position) || foundPos === -1) {
          foundPos = pos
        }
        nodeIndex++
        // Stop after checking enough nodes
        if (nodeIndex > position * 2) return false
      })
      
      if (foundPos >= 0) {
        try {
          const view = editor.view
          const coords = view.coordsAtPos(foundPos)
          const editorElement = view.dom
          const rect = editorElement.getBoundingClientRect()
          
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const targetScroll = coords.top + scrollTop - rect.top - 100
          
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          })
        } catch {
          // If even the fallback fails, just scroll to top of editor
          const editorElement = editor.view.dom
          editorElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }



  const renderOutlineItem = (item: OutlineItem, depth: number = 0) => {
    const isExpanded = expandedSections.has(item.id)
    const hasChildren = item.children.length > 0
    
    return (
      <div key={item.id} className={`outline-item depth-${depth}`}>
        <div 
          className={`outline-item-content ${item.type}`}
          onClick={() => scrollToPosition(item.position)}
        >
          {item.type === 'heading' && hasChildren && (
            <button
              className={`collapse-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleSection(item.id)
              }}
            >
              ▶
            </button>
          )}
          <span className={`outline-text heading-level-${item.level}`}>
            {item.text}
            {item.priority !== undefined && (
              <span className={`priority-badge p${item.priority}`}>p{item.priority}</span>
            )}
          </span>
          {item.type === 'heading' && hasChildren && (
            <span className="child-count">{item.children.length}</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="outline-children">
            {item.children.map(child => renderOutlineItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="content-outline">
      <div className="outline-content">
        {outlineItems.length === 0 ? (
          <div></div>
        ) : (
          outlineItems.map(item => renderOutlineItem(item))
        )}
      </div>
    </div>
  )
}

export default ContentOutline
