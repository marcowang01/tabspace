import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import React, { useState } from 'react'
import './TableOfContents.css'

interface TocItem {
  id: string
  level: number
  textContent: string
  itemIndex: number | string
  isActive: boolean
  isScrolledOver: boolean
  pos: number
}

interface TableOfContentsProps {
  editor: Editor | null
  items: TocItem[]
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ editor, items = [] }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  const handleItemClick = (e: React.MouseEvent, item: TocItem) => {
    e.preventDefault()
    
    if (!editor) return
    
    try {
      // Find the heading element with the data-toc-id attribute
      const element = editor.view.dom.querySelector(`[data-toc-id="${item.id}"]`)
      
      if (element) {
        // Get the position in the editor
        const pos = editor.view.posAtDOM(element, 0)
        
        // Set focus and selection
        const tr = editor.view.state.tr
        tr.setSelection(new TextSelection(tr.doc.resolve(pos)))
        editor.view.dispatch(tr)
        editor.view.focus()
        
        // Update URL hash
        if (window.history.pushState) {
          window.history.pushState(null, '', `#${item.id}`)
        }
        
        // Smooth scroll to the element
        window.scrollTo({
          top: element.getBoundingClientRect().top + window.scrollY - 100,
          behavior: 'smooth',
        })
      } else {
        // Fallback: use the pos directly
        editor.chain().focus().setTextSelection(item.pos).run()
        
        // Scroll to position using editor coords
        const coords = editor.view.coordsAtPos(item.pos)
        window.scrollTo({
          top: coords.top + window.scrollY - 100,
          behavior: 'smooth',
        })
      }
    } catch (error) {
      console.error('Failed to scroll to item:', error)
    }
  }
  
  // Group items by hierarchy
  const buildHierarchy = () => {
    const result: (TocItem & { children: TocItem[] })[] = []
    const stack: (TocItem & { children: TocItem[] })[] = []
    
    items.forEach(item => {
      const hierarchicalItem = { ...item, children: [] as TocItem[] }
      
      // Find the right parent based on level
      while (stack.length > 0 && stack[stack.length - 1].level >= hierarchicalItem.level) {
        stack.pop()
      }
      
      if (stack.length === 0) {
        result.push(hierarchicalItem)
      } else {
        stack[stack.length - 1].children.push(hierarchicalItem)
      }
      
      if (hierarchicalItem.level < 3) { // Only allow nesting for h1 and h2
        stack.push(hierarchicalItem)
      }
    })
    
    return result
  }
  
  const toggleSection = (itemId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }
  
  const renderItem = (item: TocItem & { children?: TocItem[] }, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedSections.has(item.id)
    const isActive = item.isActive && !item.isScrolledOver
    const isScrolledOver = item.isScrolledOver
    
    return (
      <div key={item.id} className={`toc-item depth-${depth}`}>
        <div 
          className={`toc-item-content level-${item.level} ${isActive ? 'is-active' : ''} ${isScrolledOver ? 'is-scrolled-over' : ''}`}
          onClick={(e) => handleItemClick(e, item)}
        >
          {hasChildren ? (
            <button
              className={`collapse-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleSection(item.id)
              }}
            >
              ▶
            </button>
          ) : (
            <span className="collapse-btn hidden">▶</span>
          )}
          <a 
            href={`#${item.id}`} 
            onClick={(e) => e.preventDefault()}
            className={`toc-text heading-level-${item.level}`}
            data-item-index={item.itemIndex}
          >
            <span className="toc-content">{item.textContent}</span>
          </a>
          {hasChildren && (
            <span className="child-count">{item.children?.length || 0}</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="toc-children">
            {item.children?.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }
  
  const hierarchy = buildHierarchy()
  
  if (items.length === 0) {
    return (
      <div className="table-of-contents">
        <div className="toc-content">
          <div className="toc-empty">
            <p>Start editing your document to see the outline.</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="table-of-contents">
      <div className="toc-content">
        {hierarchy.map(item => renderItem(item))}
      </div>
    </div>
  )
}

export default TableOfContents