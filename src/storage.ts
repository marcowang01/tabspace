import { JSONContent } from "@tiptap/react";
import create from 'zustand';
import { persist } from 'zustand/middleware'

type OutputData = JSONContent;
const DEFAULT_SAVE: OutputData = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { "level": 2 },
      content: [{ type: "text", text: "🪴 Welcome to your Tabspace" }]
    }, {
      type: "paragraph",
      content: [{ type: "text", text: "Treat this as your own little scratch space in the comfort of your new tab page. Your content is saved as you write and never leave your computer." }]
    }, {
      type: "paragraph",
      content: [{ type: "text", "marks": [{ type: "bold" }], "text": "This is your new digital home, set it up however you'd like!" }]
    }, {
      type: "heading",
      attrs: { "level": 3 },
      content: [{ type: "text", "text": "Getting Started" }]
    }, {
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", "text": "Not sure what you can do? Check out the " }, { type: "text", "marks": [{ type: "bold" }], "text": "help guide" }, { type: "text", "text": " by clicking on the information icon in the bottom right corner." }] }] }]
    }, {
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", "text": "Delete this start text and make this page your own!" }] }] }]
    }, {
      type: "horizontalRule"
    }, {
      type: "paragraph",
      content: [{ type: "text", "text": "Found an issue or want to contribute a feature? Check out the code on " }, { type: "text", "marks": [{ type: "link", "attrs": { "href": "https://github.com/jackyzha0/tabspace", "target": "_blank", "class": null } }], "text": "Github!" }]
    }]
}

const STRINGIFIED_SAVE = JSON.stringify(DEFAULT_SAVE);

export function load(): OutputData {
  return JSON.parse(localStorage.getItem('blocks') || STRINGIFIED_SAVE)
};

export function save(blocks: OutputData) {
  localStorage.setItem('blocks', JSON.stringify(blocks));
};

// Custom tag interface
export interface CustomTag {
  id: string,
  tag: string,
  color: string,
  enabled: boolean,
}

// zustand related
interface SettingsState {
  isDarkmode: boolean,
  toggleTheme: () => void,
  showVisualization: boolean,
  toggleVisualization: () => void,
  enableFadeIn: boolean,
  toggleFadeIn: () => void,
  enableTaskAnimation: boolean,
  toggleTaskAnimation: () => void,
  customTags: CustomTag[],
  addCustomTag: (tag: CustomTag) => void,
  updateCustomTag: (id: string, tag: Partial<CustomTag>) => void,
  deleteCustomTag: (id: string) => void,
}

export function loadDefault() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const useSettingsStore = create<SettingsState>()(persist(
  (set, get) => ({
    isDarkmode: loadDefault() === 'dark',
    toggleTheme: () => set({ isDarkmode: get().isDarkmode ? false : true }),
    showVisualization: false,
    toggleVisualization: () => set({ showVisualization: !get().showVisualization }),
    enableFadeIn: true,
    toggleFadeIn: () => set({ enableFadeIn: !get().enableFadeIn }),
    enableTaskAnimation: true,
    toggleTaskAnimation: () => set({ enableTaskAnimation: !get().enableTaskAnimation }),
    customTags: [
      { id: 'important', tag: 'important', color: '#ff6b6b', enabled: true },
      { id: 'review', tag: 'review', color: '#4ecdc4', enabled: true },
      { id: 'idea', tag: 'idea', color: '#f7b731', enabled: true }
    ],
    addCustomTag: (tag: CustomTag) => set(state => ({
      customTags: [...state.customTags, tag]
    })),
    updateCustomTag: (id: string, updates: Partial<CustomTag>) => set(state => ({
      customTags: state.customTags.map(tag =>
        tag.id === id ? { ...tag, ...updates } : tag
      )
    })),
    deleteCustomTag: (id: string) => set(state => ({
      customTags: state.customTags.filter(tag => tag.id !== id)
    })),
  }),
  {
    version: 2,
    name: 'settings',
  }
))

