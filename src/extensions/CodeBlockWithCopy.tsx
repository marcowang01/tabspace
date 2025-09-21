import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import { useState, useEffect } from 'react'
import { PasteIcon } from '../icons/paste'
import { CheckIcon } from '../icons/check'

const CodeBlockComponent = ({ node }: { node: any }) => {
  const [copied, setCopied] = useState(false)
  
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])
  
  const handleCopy = () => {
    const codeContent = node.textContent
    navigator.clipboard.writeText(codeContent).then(() => {
      setCopied(true)
    })
  }
  
  return (
    <NodeViewWrapper className="code-block-wrapper">
      <pre className="highlight">
        <button 
          className="code-copy-button" 
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <PasteIcon className="h-4 w-4" />
          )}
        </button>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

export const CodeBlockWithCopy = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  }
})
