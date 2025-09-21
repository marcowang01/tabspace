import React, { useState } from 'react'
import { Link } from 'wouter'
import { useSettingsStore, CustomTag } from './storage';
import './Settings.css'

interface ICheckbox {
  state: boolean,
  toggle: () => void,
  name: string,
  description: string,
}

function Checkbox({ name, state, toggle, description }: ICheckbox) {
  return (<div className="config-item">
    <input id={name} type="checkbox" checked={state} onChange={toggle} />
    <label htmlFor={name} />
    <div className="desc">
      <h3>{name}</h3>
      <p>{description}</p>
    </div>
  </div>)
}


interface CustomTagItemProps {
  tag: CustomTag,
  onUpdate: (id: string, updates: Partial<CustomTag>) => void,
  onDelete: (id: string) => void,
}

function CustomTagItem({ tag, onUpdate, onDelete }: CustomTagItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tagText, setTagText] = useState(tag.tag)
  const [tagColor, setTagColor] = useState(tag.color)

  const handleSave = () => {
    onUpdate(tag.id, { tag: tagText, color: tagColor })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setTagText(tag.tag)
    setTagColor(tag.color)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="config-item custom-tag-editing">
        <div className="desc" style={{ paddingLeft: '2em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75em' }}>
            <input
              type="text"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="Tag name"
              className="tag-input"
            />
            <input
              type="color"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="color-picker"
            />
            <button onClick={handleSave} className="btn-save">Save</button>
            <button onClick={handleCancel} className="btn-cancel">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="config-item custom-tag-item">
      <input
        id={`tag-${tag.id}`}
        type="checkbox"
        checked={tag.enabled}
        onChange={() => onUpdate(tag.id, { enabled: !tag.enabled })}
      />
      <label htmlFor={`tag-${tag.id}`} />
      <div className="desc">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75em' }}>
          <span
            className="tag-preview"
            style={{
              backgroundColor: `${tag.color}55`,
              padding: '0.15em 0.3em',
              borderRadius: '5px',
              fontWeight: '500',
              minWidth: '80px',
              textAlign: 'center',
              display: 'inline-block'
            }}
          >
            {tag.tag}
          </span>
          <button onClick={() => setIsEditing(true)} className="btn-edit">Edit</button>
          <button onClick={() => onDelete(tag.id)} className="btn-delete">Delete</button>
        </div>
      </div>
    </div>
  )
}

function Settings() {
  const state = useSettingsStore();
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#666666')
  const [showAddTag, setShowAddTag] = useState(false)

  const handleAddTag = () => {
    if (newTagName.trim()) {
      const newTag: CustomTag = {
        id: `custom-${Date.now()}`,
        tag: newTagName.trim(),
        color: newTagColor,
        enabled: true
      }
      state.addCustomTag(newTag)
      setNewTagName('')
      setNewTagColor('#666666')
      setShowAddTag(false)
    }
  }

  return (<div className="help">
    <Link href="/index.html"><h2 className="back">← Back</h2></Link>
    <p>Configure Tabspace to your liking.</p>
    <hr />
    <div className="config-items">
      <Checkbox state={state.isDarkmode} toggle={state.toggleTheme} name="Dark theme" description="Change the colour theme of TabSpace. Checking this box will set it to Dark mode." />
      <Checkbox state={state.showVisualization} toggle={state.toggleVisualization} name="Show task visualization" description="Adds a task visualization widget to the top of your notes page. It visualized your due dates by representing the urgency of tasks through the size of blobs." />
      <Checkbox state={state.enableFadeIn} toggle={state.toggleFadeIn} name="Fade in page" description="Adds a subtle fade-in that cascades down the page." />
      <Checkbox state={state.enableTaskAnimation} toggle={state.toggleTaskAnimation} name="Task completion animation" description="Show an animation when a task is completed. This happens when an item with a due date is deleted." />
      
      <div className="custom-tags-section">
        <h3>Custom Tags</h3>
        <p>Create custom tags that will be highlighted when typed (similar to p0, p1, p2 priority tags).</p>
        
        <div className="custom-tags-list">
          {state.customTags.map(tag => (
            <CustomTagItem
              key={tag.id}
              tag={tag}
              onUpdate={state.updateCustomTag}
              onDelete={state.deleteCustomTag}
            />
          ))}
        </div>

        {showAddTag ? (
          <div className="config-item add-tag-form">
            <div className="desc" style={{ paddingLeft: '2em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75em' }}>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="tag-input"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="color-picker"
                />
                <button onClick={handleAddTag} className="btn-save">Add Tag</button>
                <button onClick={() => {
                  setShowAddTag(false)
                  setNewTagName('')
                  setNewTagColor('#666666')
                }} className="btn-cancel">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="config-item">
            <div className="desc" style={{ paddingLeft: '2em' }}>
              <button onClick={() => setShowAddTag(true)} className="btn-add-tag">+ Add New Tag</button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}

export default Settings
