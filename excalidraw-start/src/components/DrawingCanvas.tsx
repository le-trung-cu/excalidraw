import { useState, useEffect, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { saveDrawingFn } from '../drawingServerFunctions'
import { Link } from '@tanstack/react-router'

interface Sheet {
  id: string
  name: string
  elements: string
  appState: string
  files: string
}

interface DrawingCanvasProps {
  drawing: {
    id: string
    title: string
    elements: string
    appState: string
    files: string
    sheets?: string
  }
}

export default function DrawingCanvas({ drawing }: DrawingCanvasProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Initialize sheets array with legacy drawing fallback
  const initialSheets = (() => {
    try {
      const parsed = JSON.parse(drawing.sheets || '[]')
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse sheets:', e)
    }
    return [
      {
        id: 'default',
        name: 'Sheet 1',
        elements: drawing.elements || '[]',
        appState: drawing.appState || '{}',
        files: drawing.files || '{}'
      }
    ]
  })()

  // Find sheet containing the element in URL query on initial load
  const initialActiveSheetId = (() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const elementId = searchParams.get('element')
      if (elementId) {
        const found = initialSheets.find(s => {
          try {
            const elements = JSON.parse(s.elements || '[]')
            return elements.some((el: any) => el.id === elementId)
          } catch (e) {
            return false
          }
        })
        if (found) {
          return found.id
        }
      }
    }
    return initialSheets[0].id
  })()

  const [sheets, setSheets] = useState<Sheet[]>(initialSheets)
  const [activeSheetId, setActiveSheetId] = useState<string>(initialActiveSheetId)
  
  const excalidrawAPIRef = useRef<any>(null)

  // UI states for renaming and context menus
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [activeMenuSheetId, setActiveMenuSheetId] = useState<string | null>(null)

  const activeSheet = sheets.find(s => s.id === activeSheetId) || sheets[0]

  // Track current canvas state in refs to avoid frequent state updates during drawing
  const currentElementsRef = useRef<any[]>(JSON.parse(activeSheet.elements || '[]'))
  const currentAppStateRef = useRef<any>(JSON.parse(activeSheet.appState || '{}'))
  const currentFilesRef = useRef<any>(JSON.parse(activeSheet.files || '{}'))

  // Track previous save state in refs to avoid loops
  const lastSavedSheetsRef = useRef(JSON.stringify(initialSheets))
  const lastSavedElementsRef = useRef(activeSheet.elements)
  const lastSavedAppStateRef = useRef(activeSheet.appState)
  const lastSavedFilesRef = useRef(activeSheet.files)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync refs when active sheet changes
  useEffect(() => {
    const currentActive = sheets.find(s => s.id === activeSheetId) || sheets[0]
    currentElementsRef.current = JSON.parse(currentActive.elements || '[]')
    currentAppStateRef.current = JSON.parse(currentActive.appState || '{}')
    currentFilesRef.current = JSON.parse(currentActive.files || '{}')
  }, [activeSheetId])

  // Automatically switch active sheet if URL changes and contains an element ID belonging to another sheet
  useEffect(() => {
    const handleUrlCheck = () => {
      const searchParams = new URLSearchParams(window.location.search)
      const elementId = searchParams.get('element')
      console.log('handleUrlCheck triggered. Element ID in URL:', elementId)
      if (elementId) {
        const sheetWithElement = sheets.find(s => {
          try {
            const elements = JSON.parse(s.elements || '[]')
            return elements.some((el: any) => el.id === elementId)
          } catch (e) {
            return false
          }
        })
        
        if (sheetWithElement) {
          console.log('handleUrlCheck found sheet containing element:', sheetWithElement.name)
          if (sheetWithElement.id !== activeSheetId) {
            console.log('handleUrlCheck switching to different sheet:', sheetWithElement.id)
            switchSheet(sheetWithElement.id, false)
          } else {
            console.log('handleUrlCheck same sheet: zooming to element')
            const targetElement = currentElementsRef.current.find(el => el.id === elementId)
            if (targetElement && excalidrawAPIRef.current) {
              excalidrawAPIRef.current.setViewport({
                target: targetElement,
                fit: 'scale-down',
                animation: true
              })
            } else if (excalidrawAPIRef.current) {
              // Fallback to URL string if element object not found
              excalidrawAPIRef.current.setViewport({
                target: window.location.href,
                fit: 'scale-down',
                animation: true
              })
            }
          }
        } else {
          console.warn('handleUrlCheck: No sheet containing element', elementId, 'found.')
        }
      }
    }

    window.addEventListener('popstate', handleUrlCheck)
    window.addEventListener('hashchange', handleUrlCheck)
    
    return () => {
      window.removeEventListener('popstate', handleUrlCheck)
      window.removeEventListener('hashchange', handleUrlCheck)
    }
  }, [sheets, activeSheetId])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const triggerDbSave = async (currentSheets: Sheet[], currentActiveId: string, force = false) => {
    const activeSheetData = currentSheets.find(s => s.id === currentActiveId) || currentSheets[0]
    const serializedSheets = JSON.stringify(currentSheets)

    console.log('triggerDbSave called. Force:', force)
    console.log('triggerDbSave checks:',
      'Sheets match:', serializedSheets === lastSavedSheetsRef.current,
      'Elements match:', activeSheetData.elements === lastSavedElementsRef.current,
      'AppState match:', activeSheetData.appState === lastSavedAppStateRef.current,
      'Files match:', activeSheetData.files === lastSavedFilesRef.current
    )

    if (
      !force &&
      serializedSheets === lastSavedSheetsRef.current &&
      activeSheetData.elements === lastSavedElementsRef.current &&
      activeSheetData.appState === lastSavedAppStateRef.current &&
      activeSheetData.files === lastSavedFilesRef.current
    ) {
      console.log('triggerDbSave: No DB changes, returning')
      return // No changes to save
    }

    console.log('triggerDbSave: Proceeding with DB save')
    setSaveStatus('saving')

    try {
      await saveDrawingFn({
        data: {
          id: drawing.id,
          sheets: serializedSheets,
          elements: activeSheetData.elements || '[]',
          appState: activeSheetData.appState || '{}',
          files: activeSheetData.files || '{}'
        }
      })
      lastSavedSheetsRef.current = serializedSheets
      lastSavedElementsRef.current = activeSheetData.elements || '[]'
      lastSavedAppStateRef.current = activeSheetData.appState || '{}'
      lastSavedFilesRef.current = activeSheetData.files || '{}'
      setSaveStatus('saved')
      console.log('triggerDbSave: Save successful')
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMsg(err?.message || 'Failed to save changes')
      console.error('triggerDbSave: Save failed:', err)
    }
  }

  const triggerSave = (elements: any[], appState: any, files: any) => {
    // Keep refs updated with current state
    currentElementsRef.current = elements
    currentAppStateRef.current = appState
    currentFilesRef.current = files

    const serializedElements = JSON.stringify(elements)
    
    // We only save relevant appState properties to avoid writing on every cursor mouse movement
    const cleanAppState = {
      viewBackgroundColor: appState.viewBackgroundColor,
      zenModeEnabled: appState.zenModeEnabled,
      gridSize: appState.gridSize,
      theme: appState.theme,
      zoom: appState.zoom,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(files || {})

    console.log('triggerSave called. Elements count:', elements.length)
    console.log('Comparison check:', 
      'Elements match:', serializedElements === lastSavedElementsRef.current,
      'AppState match:', serializedAppState === lastSavedAppStateRef.current,
      'Files match:', serializedFiles === lastSavedFilesRef.current
    )

    // Check if there are actual semantic changes compared to last saved
    if (
      serializedElements === lastSavedElementsRef.current &&
      serializedAppState === lastSavedAppStateRef.current &&
      serializedFiles === lastSavedFilesRef.current
    ) {
      console.log('triggerSave: No changes to save, returning early')
      return // No changes to save
    }

    if (saveTimeoutRef.current) {
      console.log('triggerSave: Clearing pending save timeout')
      clearTimeout(saveTimeoutRef.current)
    }

    console.log('triggerSave: Scheduling new save timeout in 2s')
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('Timeout fired. Processing sheets save...')
      const updatedSheets = sheets.map(s => {
        if (s.id === activeSheetId) {
          return {
            ...s,
            elements: serializedElements,
            appState: serializedAppState,
            files: serializedFiles
          }
        }
        return s
      })

      console.log('setSheets called with updated sheets')
      setSheets(updatedSheets)
      await triggerDbSave(updatedSheets, activeSheetId)
    }, 2000) // 2s debounce
  }

  const switchSheet = async (targetId: string, clearElementFromUrl = true) => {
    if (targetId === activeSheetId) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (clearElementFromUrl) {
        url.searchParams.delete('element')
      }
      url.searchParams.set('sheetId', targetId)
      window.history.pushState({}, '', url.pathname + url.search)
    }

    const serializedElements = JSON.stringify(currentElementsRef.current)
    const cleanAppState = {
      viewBackgroundColor: currentAppStateRef.current.viewBackgroundColor,
      zenModeEnabled: currentAppStateRef.current.zenModeEnabled,
      gridSize: currentAppStateRef.current.gridSize,
      theme: currentAppStateRef.current.theme,
      zoom: currentAppStateRef.current.zoom,
      scrollX: currentAppStateRef.current.scrollX,
      scrollY: currentAppStateRef.current.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(currentFilesRef.current || {})

    const updatedSheets = sheets.map(s => {
      if (s.id === activeSheetId) {
        return {
          ...s,
          elements: serializedElements,
          appState: serializedAppState,
          files: serializedFiles
        }
      }
      return s
    })

    setSheets(updatedSheets)
    setActiveSheetId(targetId)
    await triggerDbSave(updatedSheets, targetId, true)
  }

  const addSheet = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const newId = Math.random().toString(36).substring(2, 9)
    let nextNum = 1
    while (sheets.some(s => s.name === `Sheet ${nextNum}`)) {
      nextNum++
    }
    const newName = `Sheet ${nextNum}`

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('element')
      url.searchParams.set('sheetId', newId)
      window.history.pushState({}, '', url.pathname + url.search)
    }

    const newSheet: Sheet = {
      id: newId,
      name: newName,
      elements: '[]',
      appState: JSON.stringify({
        viewBackgroundColor: '#ffffff',
        zenModeEnabled: false,
        gridSize: null,
        theme: currentAppStateRef.current.theme || 'light',
      }),
      files: '{}'
    }

    const serializedElements = JSON.stringify(currentElementsRef.current)
    const cleanAppState = {
      viewBackgroundColor: currentAppStateRef.current.viewBackgroundColor,
      zenModeEnabled: currentAppStateRef.current.zenModeEnabled,
      gridSize: currentAppStateRef.current.gridSize,
      theme: currentAppStateRef.current.theme,
      zoom: currentAppStateRef.current.zoom,
      scrollX: currentAppStateRef.current.scrollX,
      scrollY: currentAppStateRef.current.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(currentFilesRef.current || {})

    const updatedSheets = sheets.map(s => {
      if (s.id === activeSheetId) {
        return {
          ...s,
          elements: serializedElements,
          appState: serializedAppState,
          files: serializedFiles
        }
      }
      return s
    })

    const finalSheets = [...updatedSheets, newSheet]
    setSheets(finalSheets)
    setActiveSheetId(newId)
    await triggerDbSave(finalSheets, newId, true)
  }

  const deleteSheet = async (sheetId: string) => {
    if (sheets.length <= 1) return

    const sheetToDelete = sheets.find(s => s.id === sheetId)
    if (!sheetToDelete) return

    if (!window.confirm(`Are you sure you want to delete "${sheetToDelete.name}"?`)) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    let newActiveId = activeSheetId
    if (sheetId === activeSheetId) {
      const idx = sheets.findIndex(s => s.id === sheetId)
      const nextActiveIdx = idx === 0 ? 1 : idx - 1
      newActiveId = sheets[nextActiveIdx].id
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('element')
      url.searchParams.set('sheetId', newActiveId)
      window.history.pushState({}, '', url.pathname + url.search)
    }

    const serializedElements = JSON.stringify(currentElementsRef.current)
    const cleanAppState = {
      viewBackgroundColor: currentAppStateRef.current.viewBackgroundColor,
      zenModeEnabled: currentAppStateRef.current.zenModeEnabled,
      gridSize: currentAppStateRef.current.gridSize,
      theme: currentAppStateRef.current.theme,
      zoom: currentAppStateRef.current.zoom,
      scrollX: currentAppStateRef.current.scrollX,
      scrollY: currentAppStateRef.current.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(currentFilesRef.current || {})

    const updatedSheets = sheets.map(s => {
      if (s.id === activeSheetId && s.id !== sheetId) {
        return {
          ...s,
          elements: serializedElements,
          appState: serializedAppState,
          files: serializedFiles
        }
      }
      return s
    }).filter(s => s.id !== sheetId)

    setSheets(updatedSheets)
    setActiveSheetId(newActiveId)
    await triggerDbSave(updatedSheets, newActiveId, true)
  }

  const duplicateSheet = async (sheetId: string) => {
    const sheetToDuplicate = sheets.find(s => s.id === sheetId)
    if (!sheetToDuplicate) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const newId = Math.random().toString(36).substring(2, 9)
    let nextNum = 1
    const baseName = `${sheetToDuplicate.name} (Copy)`
    let newName = baseName
    while (sheets.some(s => s.name === newName)) {
      newName = `${baseName} ${nextNum}`
      nextNum++
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('element')
      url.searchParams.set('sheetId', newId)
      window.history.pushState({}, '', url.pathname + url.search)
    }

    const serializedElements = JSON.stringify(currentElementsRef.current)
    const cleanAppState = {
      viewBackgroundColor: currentAppStateRef.current.viewBackgroundColor,
      zenModeEnabled: currentAppStateRef.current.zenModeEnabled,
      gridSize: currentAppStateRef.current.gridSize,
      theme: currentAppStateRef.current.theme,
      zoom: currentAppStateRef.current.zoom,
      scrollX: currentAppStateRef.current.scrollX,
      scrollY: currentAppStateRef.current.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(currentFilesRef.current || {})

    const updatedSheets = sheets.map(s => {
      if (s.id === activeSheetId) {
        return {
          ...s,
          elements: serializedElements,
          appState: serializedAppState,
          files: serializedFiles
        }
      }
      return s
    })

    const sourceSheet = updatedSheets.find(s => s.id === sheetId)!
    const newSheet: Sheet = {
      id: newId,
      name: newName,
      elements: sourceSheet.elements,
      appState: sourceSheet.appState,
      files: sourceSheet.files
    }

    const targetIndex = updatedSheets.findIndex(s => s.id === sheetId)
    const finalSheets = [...updatedSheets]
    finalSheets.splice(targetIndex + 1, 0, newSheet)

    setSheets(finalSheets)
    setActiveSheetId(newId)
    await triggerDbSave(finalSheets, newId, true)
  }

  const moveSheet = async (sheetId: string, direction: 'left' | 'right') => {
    const index = sheets.findIndex(s => s.id === sheetId)
    if (index === -1) return
    if (direction === 'left' && index === 0) return
    if (direction === 'right' && index === sheets.length - 1) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const serializedElements = JSON.stringify(currentElementsRef.current)
    const cleanAppState = {
      viewBackgroundColor: currentAppStateRef.current.viewBackgroundColor,
      zenModeEnabled: currentAppStateRef.current.zenModeEnabled,
      gridSize: currentAppStateRef.current.gridSize,
      theme: currentAppStateRef.current.theme,
      zoom: currentAppStateRef.current.zoom,
      scrollX: currentAppStateRef.current.scrollX,
      scrollY: currentAppStateRef.current.scrollY,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(currentFilesRef.current || {})

    const updatedSheets = sheets.map(s => {
      if (s.id === activeSheetId) {
        return {
          ...s,
          elements: serializedElements,
          appState: serializedAppState,
          files: serializedFiles
        }
      }
      return s
    })

    const targetIndex = direction === 'left' ? index - 1 : index + 1
    const newSheets = [...updatedSheets]

    const temp = newSheets[index]
    newSheets[index] = newSheets[targetIndex]
    newSheets[targetIndex] = temp

    setSheets(newSheets)
    await triggerDbSave(newSheets, activeSheetId, true)
  }

  const completeRename = async (sheetId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingSheetId(null)
      return
    }

    const isDuplicate = sheets.some(s => s.id !== sheetId && s.name.toLowerCase() === trimmed.toLowerCase())
    if (isDuplicate) {
      alert('A sheet with this name already exists.')
      setRenamingSheetId(null)
      return
    }

    const updatedSheets = sheets.map(s => {
      if (s.id === sheetId) {
        return { ...s, name: trimmed }
      }
      return s
    })

    setSheets(updatedSheets)
    setRenamingSheetId(null)
    await triggerDbSave(updatedSheets, activeSheetId, true)
  }

  const initialData = {
    elements: JSON.parse(activeSheet.elements || '[]'),
    appState: JSON.parse(activeSheet.appState || '{}'),
    files: JSON.parse(activeSheet.files || '{}')
  }

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--header-bg)] border-b border-[var(--line)] z-10 backdrop-blur-md h-[56px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center h-8 px-3 rounded-xl border border-[var(--line)] text-sm font-semibold text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]"
          >
            ← Back to Dashboard
          </Link>
          <h2 className="text-sm font-bold text-[var(--sea-ink)] truncate max-w-[200px] sm:max-w-xs">
            {drawing.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Saved to DB
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-semibold animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Saving changes...
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold dark:text-red-400" title={errorMsg || ''}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Save error
            </span>
          )}
        </div>
      </div>

      {/* Excalidraw Canvas Area */}
      <div className="flex-grow w-full relative" style={{ height: 'calc(100vh - 64px - 56px - 48px)' }}>
        <Excalidraw
          key={activeSheetId}
          initialData={initialData}
          onChange={(elements, appState, files) => {
            triggerSave(elements as any, appState, files)
          }}
          onExcalidrawAPI={(api) => {
            excalidrawAPIRef.current = api
          }}
          onLinkOpen={(element, event) => {
            console.log('onLinkOpen triggered for element link:', element.link)
            if (!element.link) return
            try {
              const url = new URL(element.link, window.location.origin)
              const currentUrl = new URL(window.location.href)
              
              console.log('Parsed url:', url.toString())
              console.log('Current url:', currentUrl.toString())
              console.log('Pathname check:', url.pathname, '===', currentUrl.pathname)
              
              if (url.pathname === currentUrl.pathname) {
                event.preventDefault()
                console.log('Prevented default navigation')
                
                const targetElementId = url.searchParams.get('element')
                console.log('Target element ID:', targetElementId)
                
                if (targetElementId) {
                  // Update URL in history in-place
                  window.history.pushState({}, '', url.pathname + url.search)
                  console.log('Pushed search to history:', url.search)
                  
                  let sheetWithElement = sheets.find(s => s.id === url.searchParams.get('sheetId'))
                  console.log('Found sheet by sheetId param:', sheetWithElement?.name)
                  
                  if (!sheetWithElement) {
                    sheetWithElement = sheets.find(s => {
                      try {
                        const elements = JSON.parse(s.elements || '[]')
                        return elements.some((el: any) => el.id === targetElementId)
                      } catch (e) {
                        return false
                      }
                    })
                    console.log('Found sheet by scanning elements:', sheetWithElement?.name)
                  }
                  
                  if (sheetWithElement) {
                    console.log('Active sheet ID:', activeSheetId, 'Sheet with element ID:', sheetWithElement.id)
                    if (sheetWithElement.id === activeSheetId) {
                      console.log('Same sheet - attempting to setViewport')
                      if (excalidrawAPIRef.current) {
                        const targetElement = currentElementsRef.current.find(el => el.id === targetElementId)
                        console.log('Found target element in currentElementsRef:', targetElement ? 'yes' : 'no')
                        if (targetElement) {
                          excalidrawAPIRef.current.setViewport({
                            target: targetElement,
                            fit: 'scale-down',
                            animation: true
                          })
                        } else {
                          // Fallback to URL string if element object not found
                          excalidrawAPIRef.current.setViewport({
                            target: element.link,
                            fit: 'scale-down',
                            animation: true
                          })
                        }
                      } else {
                        console.warn('excalidrawAPIRef.current is null!')
                      }
                    } else {
                      console.log('Different sheet - switching to sheet:', sheetWithElement.id)
                      switchSheet(sheetWithElement.id, false)
                    }
                  } else {
                    console.warn('No sheet containing element', targetElementId, 'was found!')
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse hyperlink:', e)
            }
          }}
          generateLinkForSelection={(id, _type) => {
            const url = new URL(window.location.href)
            url.searchParams.set('element', id)
            url.searchParams.set('sheetId', activeSheetId)
            return url.toString()
          }}
        />
      </div>

      {/* Bottom Sheet Tab Bar */}
      <div className="h-[48px] w-full bg-[var(--header-bg)] border-t border-[var(--line)] flex items-center px-4 justify-between gap-4 select-none z-10 flex-shrink-0">
        <div 
          className="flex items-center gap-1.5 overflow-x-auto flex-grow h-full py-1.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sheets.map((s, idx) => {
            const isActive = s.id === activeSheetId
            return (
              <div
                key={s.id}
                className={`relative flex items-center gap-1.5 h-[32px] px-3 rounded-lg border text-xs font-bold transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-[var(--bg-base)] border-[var(--lagoon)] text-[var(--sea-ink)] shadow-sm'
                    : 'bg-[var(--chip-bg)] border-[var(--line)] text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)]'
                }`}
              >
                {renamingSheetId === s.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') completeRename(s.id)
                      if (e.key === 'Escape') setRenamingSheetId(null)
                    }}
                    onBlur={() => completeRename(s.id)}
                    className="w-20 bg-transparent outline-none border-b border-[var(--lagoon)] text-[var(--sea-ink)] px-0.5 py-0 font-bold"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setRenamingSheetId(s.id)
                      setRenameValue(s.name)
                    }}
                    onClick={() => switchSheet(s.id)}
                    className="cursor-pointer py-1 min-w-[45px] max-w-[120px] truncate"
                    title="Double click to rename"
                  >
                    {s.name}
                  </span>
                )}

                {/* Tab actions menu toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenuSheetId(s.id === activeMenuSheetId ? null : s.id)
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-[var(--sea-ink-soft)] cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {/* Dropdown context menu */}
                {activeMenuSheetId === s.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuSheetId(null)
                      }}
                    />
                    <div className="absolute bottom-[36px] left-0 z-50 min-w-[150px] py-1.5 bg-[var(--surface-strong)] border border-[var(--line)] rounded-xl shadow-xl backdrop-blur-md text-xs text-[var(--sea-ink)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingSheetId(s.id)
                          setRenameValue(s.name)
                          setActiveMenuSheetId(null)
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-[var(--link-bg-hover)] font-bold cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicateSheet(s.id)
                          setActiveMenuSheetId(null)
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-[var(--link-bg-hover)] font-bold cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Duplicate
                      </button>
                      {idx > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveSheet(s.id, 'left')
                            setActiveMenuSheetId(null)
                          }}
                          className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-[var(--link-bg-hover)] font-bold cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"/>
                            <polyline points="12 19 5 12 12 5"/>
                          </svg>
                          Move Left
                        </button>
                      )}
                      {idx < sheets.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveSheet(s.id, 'right')
                            setActiveMenuSheetId(null)
                          }}
                          className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-[var(--link-bg-hover)] font-bold cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="12 5 19 12 12 19"/>
                          </svg>
                          Move Right
                        </button>
                      )}
                      <div className="h-[1px] bg-[var(--line)] my-1.5" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSheet(s.id)
                          setActiveMenuSheetId(null)
                        }}
                        disabled={sheets.length <= 1}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <button
            onClick={addSheet}
            className="p-1.5 rounded-lg hover:bg-[var(--link-bg-hover)] text-[var(--sea-ink)] border border-[var(--line)] flex items-center justify-center cursor-pointer transition-all active:scale-95 bg-[var(--chip-bg)] h-[32px] w-[32px] flex-shrink-0"
            title="Add new sheet"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
