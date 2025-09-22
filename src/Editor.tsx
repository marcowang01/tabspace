import { Editor as TiptapEditor } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Focus from '@tiptap/extension-focus';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TableOfContentsExtension, { getHierarchicalIndexes } from '@tiptap/extension-table-of-contents';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Typography from '@tiptap/extension-typography';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark } from 'prosemirror-model';
import { ClipboardEventHandler, DragEvent, useEffect, useRef, useState } from 'react';
import './Editor.scss';
import { CodeBlockWithCopy } from './extensions/CodeBlockWithCopy';
import { load, save, useSettingsStore } from './storage';
import TableOfContents from './TableOfContents';
import { CustomTagMark } from './tasks/CustomTagMark';
import { PriorityMark } from './tasks/PriorityMark';
import { TimedTask } from './tasks/TimedTask';

export interface Tasks {
  due: number, // JS date in milliseconds past epoch
  uid: string,
}

export interface Position {
  top: number,
  bottom: number,
  left: number,
  right: number,
}

export interface IEditor {
  setTasks: (cb: ((tasks: Tasks[]) => Tasks[])) => void,
}

function traverseMarks(editor: TiptapEditor, cb: (timedMark: Mark) => void) {
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'text') {
      const timeMark = node.marks.find((mark) => mark.type.name === 'timedTask');
      if (timeMark !== undefined) {
        // @ts-ignore
        cb(timeMark)
      }
    }
  });
}

const Editor = ({ setTasks }: IEditor) => {
  const positions = useRef<Map<string, DOMRect>>(new Map());
  const customTags = useSettingsStore(state => state.customTags);
  const [tocItems, setTocItems] = useState<any[]>([]);
  
  // Create CustomTagMark configuration  
  const customTagExtension = CustomTagMark.configure({
    customTags: customTags
  });

  const refreshPositions = (editor: TiptapEditor) => {
    const newPositions: Map<string, DOMRect> = new Map(positions.current);
    traverseMarks(editor, (timeMark) => {
      const id = timeMark.attrs.uid;
      const spanEl = document.getElementById(id);
      if (spanEl && spanEl.parentElement) {
        newPositions.set(id, spanEl.parentElement.getBoundingClientRect())
      }
    })
    positions.current = newPositions
  }

  const refreshTasks = (editor: TiptapEditor) => {
    const newTasks: Tasks[] = [];
    traverseMarks(editor, (timeMark) => newTasks.push({ due: timeMark.attrs.time, uid: timeMark.attrs.uid }))
    setTasks((oldTasks: Tasks[]) => {
      if (JSON.stringify(oldTasks) !== JSON.stringify(newTasks)) {
        // check for deleted tasks here
        const completedTasks = oldTasks
          .filter(({ uid }) => !newTasks.find((task: Tasks) => task.uid === uid))
          .map(t => t.uid)

        // only animate one task because reflow screws the rest of them up
        if (completedTasks.length === 1) {
          const id = completedTasks[0]
          const boundingRect = positions.current.get(id);
          const effectLayer = document.getElementById("effects-layer");
          if (effectLayer && boundingRect) {
            const { top, left, width, height } = boundingRect;
            const effect = document.createElement("div");
            effect.classList.add("effect");
            Object.assign(effect.style, {
              width: `${width}px`,
              height: `${height}px`,
              top: `${top + window.scrollY}px`,
              left: `${left + window.scrollX}px`,
            });
            effectLayer.appendChild(effect);
            positions.current.delete(id);
            setTimeout(() => effect.remove(), 500)
          }
        }
        return newTasks;
      } else {
        return oldTasks;
      }
    })
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
        blockquote: false,
      }),
      CodeBlockWithCopy,
      Blockquote.extend({
        priority: 100
      }),
      Focus.configure({
        mode: 'deepest',
      }),
      Link,
      Placeholder.configure({
        placeholder: "What's on your mind?",
      }),
      Typography,
      Image,
      TimedTask,
      PriorityMark,
      customTagExtension,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableOfContentsExtension.configure({
        anchorTypes: ['heading'],
        getIndex: getHierarchicalIndexes,
        scrollParent: () => window,
        onUpdate: (content) => {
          setTocItems(content)
        },
      }),
    ],
    content: load(),
    onCreate: ({ editor }) => refreshTasks(editor),
    // this triggers after reflow
    onTransaction: ({ editor }) => refreshPositions(editor),
    onUpdate: ({ editor }) => {
      document.documentElement.setAttribute('fade-in', 'false');
      refreshTasks(editor);
      save(editor.getJSON())
    }
  }, [customTags]); // Re-create editor when custom tags change

  // @ts-ignore
  window['tabspace'] = {
    dump: () => editor ? editor.getJSON() : null
  };

  useEffect(() => {
    const updateClosure = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === 'blocks' && event.newValue !== null) {
        if (editor) {
          editor.commands.setContent(JSON.parse(event.newValue));
          refreshTasks(editor);
        }
      }
    };
    window.addEventListener('storage', updateClosure);
    return () => window.removeEventListener('storage', updateClosure);
  });

  const insertImage = (img: File) => {
    const reader = new FileReader();
    reader.addEventListener('load', (evt) => {
      if (evt.target && editor) {
        const uploaded_image = "" + evt.target.result;
        editor.chain().focus().setImage({ src: uploaded_image }).run()
      }
    });
    reader.readAsDataURL(img);
  }

  const handleDrop = (evt: DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    const fileList = evt.dataTransfer.files;
    if (fileList.length >= 1) {
      const file = fileList[0];
      insertImage(file);
    }
  }

  const handlePaste: ClipboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.clipboardData.files.length > 0) {
      const file = evt.clipboardData.files[0];
      insertImage(file);
    }
  }

  const handleInsertNewline = () => {
    if (editor) {
      editor.commands.focus('end')
      editor.commands.enter()
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className="editor-container">
      <div className="editor-main sidebar-expanded">
        <EditorContent onDrop={handleDrop} editor={editor} onPaste={handlePaste} id="editor" />
        <div className="newline-handle" onClick={handleInsertNewline}>
          <p>+ Click here to insert a new line</p>
        </div>
      </div>
      <TableOfContents 
        editor={editor}
        items={tocItems}
      />
    </div>
  )
}

export default Editor;
