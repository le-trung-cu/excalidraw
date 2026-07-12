import { useState, useEffect, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { saveDrawingFn } from '../drawingServerFunctions'
import { Link } from '@tanstack/react-router'

interface DrawingCanvasProps {
  drawing: {
    id: string
    title: string
    elements: string
    appState: string
    files: string
  }
}

export default function DrawingCanvas({ drawing }: DrawingCanvasProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Track previous save state in refs to avoid loops
  const lastSavedElementsRef = useRef(drawing.elements)
  const lastSavedAppStateRef = useRef(drawing.appState)
  const lastSavedFilesRef = useRef(drawing.files)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerSave = (elements: any[], appState: any, files: any) => {
    // Excalidraw onChange triggers on cursor changes etc, so we filter elements to save
    const activeElements = elements.filter(el => !el.isDeleted)
    const serializedElements = JSON.stringify(elements)
    
    // We only save relevant appState properties to avoid writing on every cursor mouse movement
    const cleanAppState = {
      viewBackgroundColor: appState.viewBackgroundColor,
      zenModeEnabled: appState.zenModeEnabled,
      gridSize: appState.gridSize,
      theme: appState.theme,
    }
    const serializedAppState = JSON.stringify(cleanAppState)
    const serializedFiles = JSON.stringify(files || {})

    // Check if there are actual semantic changes compared to last saved
    if (
      serializedElements === lastSavedElementsRef.current &&
      serializedAppState === lastSavedAppStateRef.current &&
      serializedFiles === lastSavedFilesRef.current
    ) {
      return // No changes to save
    }

    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveDrawingFn({
          data: {
            id: drawing.id,
            elements: serializedElements,
            appState: serializedAppState,
            files: serializedFiles
          }
        })
        lastSavedElementsRef.current = serializedElements
        lastSavedAppStateRef.current = serializedAppState
        lastSavedFilesRef.current = serializedFiles
        setSaveStatus('saved')
      } catch (err: any) {
        setSaveStatus('error')
        setErrorMsg(err?.message || 'Failed to save changes')
      }
    }, 2000) // 2s debounce
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Initial data parsed from database
  const initialData = {
    elements: JSON.parse(drawing.elements || '[]'),
    appState: JSON.parse(drawing.appState || '{}'),
    files: JSON.parse(drawing.files || '{}')
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--header-bg)] border-b border-[var(--line)] z-10 backdrop-blur-md">
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
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
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
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold" title={errorMsg || ''}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Save error
            </span>
          )}
        </div>
      </div>

      {/* Excalidraw Canvas Area */}
      <div className="flex-grow w-full h-full relative" style={{ height: 'calc(100vh - 120px)' }}>
        <Excalidraw
          initialData={initialData}
          onChange={(elements, appState, files) => {
            triggerSave(elements as any, appState, files)
          }}
        />
      </div>
    </div>
  )
}
