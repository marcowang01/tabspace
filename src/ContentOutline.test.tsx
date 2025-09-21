import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JSONContent } from '@tiptap/react'
import ContentOutline from './ContentOutline'

// Extract the utility functions for testing
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

interface OutlineItem {
  id: string
  type: 'heading' | 'task' | 'paragraph' | 'listItem'
  level: number
  text: string
  priority?: number
  position: number
  children: OutlineItem[]
  originalNode?: JSONContent
}

const buildOutlineTree = (doc: JSONContent): OutlineItem[] => {
  const items: OutlineItem[] = []
  let currentSection: OutlineItem | null = null
  let position = 0
  const sectionStack: OutlineItem[] = []

  const processNode = (node: JSONContent, skipContent: boolean = false) => {
    position++
    
    if (node.type === 'heading') {
      const text = extractTextFromNode(node)
      const level = node.attrs?.level || 1
      const newSection: OutlineItem = {
        id: `heading-${position}`,
        type: 'heading',
        level,
        text,
        position,
        children: [],
        originalNode: node
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
        node.content.forEach(child => processNode(child))
      }
      return // Don't process content again
      
    } else if (node.type === 'taskItem' || node.type === 'listItem') {
      const text = extractTextFromNode(node)
      const priority = extractPriority(text)
      
      if (text.trim()) {
        const item: OutlineItem = {
          id: `item-${position}`,
          type: node.type === 'taskItem' ? 'task' : 'listItem',
          level: 0,
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          priority,
          position,
          children: [],
          originalNode: node
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
          id: `item-${position}`,
          type: 'paragraph',
          level: 0,
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          priority,
          position,
          children: [],
          originalNode: node
        }
        
        if (currentSection) {
          currentSection.children.push(item)
        } else {
          items.push(item)
        }
      }
    }
    
    // Only process content if we haven't already handled it above
    if (!skipContent && node.content && node.type !== 'taskItem' && node.type !== 'listItem') {
      node.content.forEach(child => processNode(child))
    }
  }
  
  if (doc.content) {
    doc.content.forEach(node => processNode(node))
  }
  
  return items
}

const sortItemsWithinSections = (items: OutlineItem[]): OutlineItem[] => {
  return items.map(item => {
    if (item.type === 'heading' && item.children.length > 0) {
      // Recursively sort nested sections first
      const recursiveSorted = sortItemsWithinSections(item.children)
      
      // Then sort items at this level (separate headings from other items)
      const headings = recursiveSorted.filter(child => child.type === 'heading')
      const otherItems = recursiveSorted.filter(child => child.type !== 'heading')
      
      const sortedOtherItems = otherItems.sort((a, b) => {
        // Handle undefined priorities
        if (a.priority === undefined && b.priority === undefined) return 0
        if (a.priority === undefined) return 1
        if (b.priority === undefined) return -1
        return a.priority - b.priority
      })
      
      // Combine: other items first (sorted), then headings (to maintain document structure)
      return { ...item, children: [...sortedOtherItems, ...headings] }
    }
    return item
  })
}

describe('ContentOutline Utility Functions', () => {
  describe('extractPriority', () => {
    it('should extract priority from p0, p1, p2 format', () => {
      expect(extractPriority('p0 high priority task')).toBe(0)
      expect(extractPriority('p1 medium priority task')).toBe(1)
      expect(extractPriority('p2 low priority task')).toBe(2)
      expect(extractPriority('p10 very low priority')).toBe(10)
    })

    it('should handle case insensitive priority markers', () => {
      expect(extractPriority('P0 HIGH PRIORITY')).toBe(0)
      expect(extractPriority('P1 Medium Priority')).toBe(1)
    })

    it('should handle priority markers anywhere in text', () => {
      expect(extractPriority('This is p0 urgent')).toBe(0)
      expect(extractPriority('Complete task p1 by Friday')).toBe(1)
      expect(extractPriority('Review code and p2 test')).toBe(2)
    })

    it('should handle multiple priority markers (use first one)', () => {
      expect(extractPriority('p0 urgent p1 also')).toBe(0)
      expect(extractPriority('p2 low p0 high')).toBe(2)
    })

    it('should return undefined for no priority markers', () => {
      expect(extractPriority('regular task')).toBeUndefined()
      expect(extractPriority('task with numbers 123')).toBeUndefined()
      expect(extractPriority('p task')).toBeUndefined()
      expect(extractPriority('priority 1')).toBeUndefined()
    })

    it('should handle edge cases', () => {
      expect(extractPriority('')).toBeUndefined()
      expect(extractPriority('p')).toBeUndefined()
      expect(extractPriority('p-1')).toBeUndefined()
      expect(extractPriority('pp0')).toBeUndefined()
    })
  })

  describe('extractTextFromNode', () => {
    it('should extract text from simple text node', () => {
      const node: JSONContent = {
        type: 'text',
        text: 'Hello world'
      }
      expect(extractTextFromNode(node)).toBe('Hello world')
    })

    it('should extract text from nested content', () => {
      const node: JSONContent = {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' }
        ]
      }
      expect(extractTextFromNode(node)).toBe('Hello world')
    })

    it('should handle empty text nodes', () => {
      const node: JSONContent = {
        type: 'text',
        text: ''
      }
      expect(extractTextFromNode(node)).toBe('')
    })

    it('should handle nodes without content', () => {
      const node: JSONContent = {
        type: 'paragraph'
      }
      expect(extractTextFromNode(node)).toBe('')
    })

    it('should handle complex nested structures', () => {
      const node: JSONContent = {
        type: 'taskItem',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'p0 ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'urgent' },
              { type: 'text', text: ' task' }
            ]
          }
        ]
      }
      expect(extractTextFromNode(node)).toBe('p0 urgent task')
    })
  })

  describe('buildOutlineTree', () => {
    it('should build outline from simple document', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Heading' }]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p0 urgent task' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const outline = buildOutlineTree(doc)
      expect(outline).toHaveLength(1)
      expect(outline[0].type).toBe('heading')
      expect(outline[0].text).toBe('Main Heading')
      expect(outline[0].children).toHaveLength(1)
      expect(outline[0].children[0].priority).toBe(0)
    })

    it('should handle multiple sections', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Section 1' }]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p1 task 1' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Section 2' }]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p0 task 2' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const outline = buildOutlineTree(doc)
      expect(outline).toHaveLength(2)
      expect(outline[0].text).toBe('Section 1')
      expect(outline[1].text).toBe('Section 2')
      expect(outline[0].children[0].priority).toBe(1)
      expect(outline[1].children[0].priority).toBe(0)
    })

    it('should handle nested headings', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main' }]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Sub' }]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p0 sub task' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const outline = buildOutlineTree(doc)
      expect(outline).toHaveLength(1)
      expect(outline[0].text).toBe('Main')
      expect(outline[0].children).toHaveLength(1)
      expect(outline[0].children[0].type).toBe('heading')
      expect(outline[0].children[0].text).toBe('Sub')
    })

    it('should handle mixed content types', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Mixed Content' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'p2 regular paragraph' }]
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p1 bullet item' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p0 task item' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const outline = buildOutlineTree(doc)
      expect(outline).toHaveLength(1)
      expect(outline[0].children).toHaveLength(3)
      expect(outline[0].children[0].type).toBe('paragraph')
      expect(outline[0].children[1].type).toBe('listItem')
      expect(outline[0].children[2].type).toBe('task')
    })

    it('should handle empty sections', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Empty Section' }]
          },
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Non-empty Section' }]
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'p0 task' }]
                  }
                ]
              }
            ]
          }
        ]
      }

      const outline = buildOutlineTree(doc)
      expect(outline).toHaveLength(2)
      expect(outline[0].children).toHaveLength(0)
      expect(outline[1].children).toHaveLength(1)
    })
  })

  describe('sortItemsWithinSections', () => {
    it('should sort items by priority within sections', () => {
      const items: OutlineItem[] = [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Section 1',
          position: 1,
          children: [
            {
              id: 't1',
              type: 'task',
              level: 0,
              text: 'p2 low priority',
              priority: 2,
              position: 2,
              children: []
            },
            {
              id: 't2',
              type: 'task',
              level: 0,
              text: 'p0 high priority',
              priority: 0,
              position: 3,
              children: []
            },
            {
              id: 't3',
              type: 'task',
              level: 0,
              text: 'p1 medium priority',
              priority: 1,
              position: 4,
              children: []
            }
          ]
        }
      ]

      const sorted = sortItemsWithinSections(items)
      expect(sorted[0].children[0].priority).toBe(0)
      expect(sorted[0].children[1].priority).toBe(1)
      expect(sorted[0].children[2].priority).toBe(2)
    })

    it('should handle items without priorities', () => {
      const items: OutlineItem[] = [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Section 1',
          position: 1,
          children: [
            {
              id: 't1',
              type: 'task',
              level: 0,
              text: 'no priority',
              priority: undefined,
              position: 2,
              children: []
            },
            {
              id: 't2',
              type: 'task',
              level: 0,
              text: 'p0 high priority',
              priority: 0,
              position: 3,
              children: []
            },
            {
              id: 't3',
              type: 'task',
              level: 0,
              text: 'another no priority',
              priority: undefined,
              position: 4,
              children: []
            }
          ]
        }
      ]

      const sorted = sortItemsWithinSections(items)
      expect(sorted[0].children[0].priority).toBe(0)
      expect(sorted[0].children[1].priority).toBeUndefined()
      expect(sorted[0].children[2].priority).toBeUndefined()
    })

    it('should not sort across different sections', () => {
      const items: OutlineItem[] = [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Section 1',
          position: 1,
          children: [
            {
              id: 't1',
              type: 'task',
              level: 0,
              text: 'p2 in section 1',
              priority: 2,
              position: 2,
              children: []
            }
          ]
        },
        {
          id: 'h2',
          type: 'heading',
          level: 1,
          text: 'Section 2',
          position: 3,
          children: [
            {
              id: 't2',
              type: 'task',
              level: 0,
              text: 'p0 in section 2',
              priority: 0,
              position: 4,
              children: []
            }
          ]
        }
      ]

      const sorted = sortItemsWithinSections(items)
      // p0 should stay in section 2, not move to section 1
      expect(sorted[0].children[0].priority).toBe(2)
      expect(sorted[1].children[0].priority).toBe(0)
    })

    it('should handle empty sections', () => {
      const items: OutlineItem[] = [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Empty Section',
          position: 1,
          children: []
        }
      ]

      const sorted = sortItemsWithinSections(items)
      expect(sorted[0].children).toHaveLength(0)
    })

    it('should preserve original order for items with same priority', () => {
      const items: OutlineItem[] = [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Section 1',
          position: 1,
          children: [
            {
              id: 't1',
              type: 'task',
              level: 0,
              text: 'p1 first task',
              priority: 1,
              position: 2,
              children: []
            },
            {
              id: 't2',
              type: 'task',
              level: 0,
              text: 'p1 second task',
              priority: 1,
              position: 3,
              children: []
            }
          ]
        }
      ]

      const sorted = sortItemsWithinSections(items)
      expect(sorted[0].children[0].text).toBe('p1 first task')
      expect(sorted[0].children[1].text).toBe('p1 second task')
    })
  })
})

// Integration tests for the complete sorting workflow
describe('ContentOutline Sorting Integration', () => {
  it('should handle the complete sorting workflow', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Tasks' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p1 Review code' }]
                }
              ]
            }
          ]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p0 Fix critical bug' }]
                }
              ]
            }
          ]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p2 Write documentation' }]
                }
              ]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Frontend' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p2 Update UI' }]
                }
              ]
            }
          ]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p0 Fix login issue' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const outline = buildOutlineTree(doc)
    const sorted = sortItemsWithinSections(outline)

    // Should have main section with 3 tasks + 1 subsection sorted by priority
    expect(sorted[0].text).toBe('Project Tasks')
    expect(sorted[0].children).toHaveLength(4) // 3 tasks + 1 subsection
    
    // Tasks should be sorted: p0, p1, p2
    const mainTasks = sorted[0].children.filter(item => item.type === 'task')
    expect(mainTasks).toHaveLength(3)
    expect(mainTasks[0].priority).toBe(0) // Fix critical bug
    expect(mainTasks[1].priority).toBe(1) // Review code  
    expect(mainTasks[2].priority).toBe(2) // Write documentation

    // Subsection should have its tasks sorted independently
    const frontendSection = sorted[0].children.find(item => item.type === 'heading')
    expect(frontendSection?.text).toBe('Frontend')
    expect(frontendSection?.children).toHaveLength(2)
    expect(frontendSection?.children[0].priority).toBe(0) // Fix login issue
    expect(frontendSection?.children[1].priority).toBe(2) // Update UI
  })

  it('should handle complex nested structures with mixed content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Overview' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'p1 Project description' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Backend Tasks' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p2 Setup database' }]
                }
              ]
            }
          ]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p0 API endpoints' }]
                }
              ]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Frontend Tasks' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p1 Component library' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const outline = buildOutlineTree(doc)
    const sorted = sortItemsWithinSections(outline)

    expect(sorted).toHaveLength(1) // Main project overview
    expect(sorted[0].text).toBe('Project Overview')
    expect(sorted[0].children).toHaveLength(3) // 1 paragraph + 2 subsections

    // Check that paragraph is sorted first (p1)
    const mainParagraph = sorted[0].children.find(item => item.type === 'paragraph')
    expect(mainParagraph?.priority).toBe(1)

    // Check backend section sorting
    const backendSection = sorted[0].children.find(item => item.text === 'Backend Tasks')
    expect(backendSection?.children).toHaveLength(2)
    expect(backendSection?.children[0].priority).toBe(0) // API endpoints
    expect(backendSection?.children[1].priority).toBe(2) // Setup database

    // Check frontend section
    const frontendSection = sorted[0].children.find(item => item.text === 'Frontend Tasks')
    expect(frontendSection?.children).toHaveLength(1)
    expect(frontendSection?.children[0].priority).toBe(1) // Component library
  })

  it('should handle documents with no priorities', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Regular Tasks' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'First task' }]
                }
              ]
            }
          ]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Second task' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const outline = buildOutlineTree(doc)
    const sorted = sortItemsWithinSections(outline)

    expect(sorted[0].children).toHaveLength(2)
    // Order should remain unchanged when no priorities
    expect(sorted[0].children[0].text).toBe('First task')
    expect(sorted[0].children[1].text).toBe('Second task')
  })

  it('should handle empty document', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: []
    }

    const outline = buildOutlineTree(doc)
    const sorted = sortItemsWithinSections(outline)

    expect(outline).toHaveLength(0)
    expect(sorted).toHaveLength(0)
  })
})

// Mock TipTap Editor for scrolling tests
const createMockEditor = (jsonContent: JSONContent) => {
  const mockDom = document.createElement('div')
  // Add the scrollIntoView method to the mock DOM element
  mockDom.scrollIntoView = jest.fn()
  
  const mockView = {
    dom: mockDom,
    coordsAtPos: jest.fn((pos: number) => ({
      top: pos * 20, // Mock: each position is 20px apart
      left: 0,
      right: 100,
      bottom: pos * 20 + 20
    }))
  }

  const mockState = {
    doc: {
      descendants: jest.fn((callback: (node: any, pos: number) => boolean | void) => {
        // Mock document traversal
        let pos = 0
        const traverse = (node: JSONContent) => {
          const result = callback(node, pos)
          if (result === false) return false
          pos++
          if (node.content) {
            for (const child of node.content) {
              if (traverse(child) === false) return false
            }
          }
        }
        if (jsonContent.content) {
          for (const node of jsonContent.content) {
            if (traverse(node) === false) break
          }
        }
      })
    }
  }

  return {
    getJSON: jest.fn(() => jsonContent),
    on: jest.fn(),
    off: jest.fn(),
    view: mockView,
    state: mockState
  }
}

// Mock window.scrollTo
const mockScrollTo = jest.fn()
Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true
})

// Mock window.pageYOffset
Object.defineProperty(window, 'pageYOffset', {
  value: 0,
  writable: true,
  configurable: true
})

describe('ContentOutline Scrolling Functionality', () => {
  beforeEach(() => {
    mockScrollTo.mockClear()
    // Reset page offset
    Object.defineProperty(window, 'pageYOffset', {
      value: 0,
      writable: true,
      configurable: true
    })
  })

  it('should scroll to correct position when clicking on a heading', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Test Heading' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some content' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    // Find and click the heading
    const headingElement = screen.getByText('Test Heading')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 0, // coords.top (0) + currentScrollTop (0) - 100 = -100, but Math.max(0, -100) = 0
        behavior: 'smooth'
      })
    })
  })

  it('should scroll to correct position when clicking on a task item', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Tasks' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p0 Important task' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    // First expand the Tasks section to see the task item
    const tasksHeading = screen.getByText('Tasks')
    const expandButton = tasksHeading.parentElement?.querySelector('.collapse-btn')
    if (expandButton) {
      fireEvent.click(expandButton)
    }

    await waitFor(() => {
      expect(screen.getByText('p0 Important task')).toBeInTheDocument()
    })

    // Now find and click the task item
    const taskElement = screen.getByText('p0 Important task')
    fireEvent.click(taskElement)

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalled()
      const callArgs = mockScrollTo.mock.calls[mockScrollTo.mock.calls.length - 1][0]
      expect(callArgs.behavior).toBe('smooth')
      expect(typeof callArgs.top).toBe('number')
      expect(callArgs.top).toBeGreaterThanOrEqual(0) // Should never scroll above page
    })
  })

  it('should account for current scroll position when scrolling', async () => {
    // Mock current page scroll position
    Object.defineProperty(window, 'pageYOffset', {
      value: 500,
      writable: true,
      configurable: true
    })

    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Scrolled Heading' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    const headingElement = screen.getByText('Scrolled Heading')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 400, // currentScrollTop (500) + coords.top (0) - 100 = 400
        behavior: 'smooth'
      })
    })
  })

  it('should handle scrolling to positions that would result in negative scroll', async () => {
    // Mock a scenario where the target would be above the page
    Object.defineProperty(window, 'pageYOffset', {
      value: 50,
      writable: true,
      configurable: true
    })

    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Top Heading' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    const headingElement = screen.getByText('Top Heading')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 0, // Math.max(0, 50 + 0 - 100) = Math.max(0, -50) = 0
        behavior: 'smooth'
      })
    })
  })

  it('should handle errors gracefully and use fallback scrolling', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Error Heading' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    // Make initial coordsAtPos throw an error, but allow fallback to work
    let callCount = 0
    mockEditor.view.coordsAtPos.mockImplementation((pos: number) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Position out of bounds')
      }
      // Fallback call should succeed
      return {
        top: pos * 20,
        left: 0,
        right: 100,
        bottom: pos * 20 + 20
      }
    })

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    render(<ContentOutline editor={mockEditor as any} />)

    const headingElement = screen.getByText('Error Heading')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Position out of bounds, using fallback navigation', expect.any(Error))
      // Should still attempt to scroll using fallback
      expect(mockScrollTo).toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })

  it('should handle fallback when coordsAtPos fails but document traversal succeeds', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Fallback Heading' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    // Make initial coordsAtPos fail, but fallback coordsAtPos succeed
    let callCount = 0
    mockEditor.view.coordsAtPos.mockImplementation((pos: number) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Initial call fails')
      }
      return {
        top: pos * 20,
        left: 0,
        right: 100,
        bottom: pos * 20 + 20
      }
    })

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    render(<ContentOutline editor={mockEditor as any} />)

    const headingElement = screen.getByText('Fallback Heading')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
      expect(mockScrollTo).toHaveBeenCalled()
      // Should have called coordsAtPos twice - once for initial attempt, once for fallback
      expect(mockEditor.view.coordsAtPos).toHaveBeenCalledTimes(2)
    })

    consoleSpy.mockRestore()
  })

  it('should scroll to editor element when all else fails', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Final Fallback' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    // Make all coordsAtPos calls fail
    mockEditor.view.coordsAtPos.mockImplementation(() => {
      throw new Error('All calls fail')
    })

    // The scrollIntoView mock is already set up in createMockEditor
    const mockScrollIntoView = mockEditor.view.dom.scrollIntoView as jest.Mock

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    render(<ContentOutline editor={mockEditor as any} />)

    const headingElement = screen.getByText('Final Fallback')
    fireEvent.click(headingElement)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      })
    })

    consoleSpy.mockRestore()
  })

  it('should not attempt to scroll when editor is null', () => {
    render(<ContentOutline editor={null} />)
    
    // Should render empty outline without errors
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
    expect(mockScrollTo).not.toHaveBeenCalled()
  })

  it('should scroll to correct positions for nested content', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Main Section' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Subsection' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'p1 Nested task' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    // Expand the main section first
    const mainSection = screen.getByText('Main Section')
    const expandButton = mainSection.parentElement?.querySelector('.collapse-btn')
    if (expandButton) {
      fireEvent.click(expandButton)
    }

    await waitFor(() => {
      // Should now see the subsection
      expect(screen.getByText('Subsection')).toBeInTheDocument()
    })

    // Expand the subsection to see the task
    const subsection = screen.getByText('Subsection')
    const subExpandButton = subsection.parentElement?.querySelector('.collapse-btn')
    if (subExpandButton) {
      fireEvent.click(subExpandButton)
    }

    await waitFor(() => {
      expect(screen.getByText('p1 Nested task')).toBeInTheDocument()
    })

    // Click on the nested task
    const nestedTask = screen.getByText('p1 Nested task')
    fireEvent.click(nestedTask)

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalled()
      const callArgs = mockScrollTo.mock.calls[mockScrollTo.mock.calls.length - 1][0]
      expect(callArgs.behavior).toBe('smooth')
      expect(callArgs.top).toBeGreaterThanOrEqual(0)
    })
  })

  it('should maintain smooth scrolling behavior for all scroll attempts', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Smooth Scroll Test' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Test paragraph' }]
        }
      ]
    }

    const mockEditor = createMockEditor(doc)
    render(<ContentOutline editor={mockEditor as any} />)

    // Click on heading
    fireEvent.click(screen.getByText('Smooth Scroll Test'))
    
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      )
    })

    // Expand the heading section to see the paragraph
    const heading = screen.getByText('Smooth Scroll Test')
    const expandButton = heading.parentElement?.querySelector('.collapse-btn')
    if (expandButton) {
      fireEvent.click(expandButton)
    }

    await waitFor(() => {
      expect(screen.getByText('Test paragraph')).toBeInTheDocument()
    })

    // Click on paragraph
    fireEvent.click(screen.getByText('Test paragraph'))
    
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      )
    })

    // All calls should have smooth behavior
    mockScrollTo.mock.calls.forEach(call => {
      expect(call[0].behavior).toBe('smooth')
    })
  })
})
