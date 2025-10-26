import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { initializeDatabase } from '../database'
import ModelManager from '../model/ModelManager'

interface AppState {
  dbReady: boolean
  modelsReady: boolean
  downloadProgress: number
  error: string | null
}

type AppAction =
  | { type: 'DB_READY' }
  | { type: 'MODEL_PROGRESS'; progress: number }
  | { type: 'MODEL_READY' }
  | { type: 'ERROR'; message: string }

const initialState: AppState = {
  dbReady: false,
  modelsReady: false,
  downloadProgress: 0,
  error: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'DB_READY':
      return { ...state, dbReady: true }
    case 'MODEL_PROGRESS':
      return { ...state, downloadProgress: action.progress }
    case 'MODEL_READY':
      return { ...state, modelsReady: true }
    case 'ERROR':
      return { ...state, error: action.message }
    default:
      return state
  }
}

const AppContext = createContext<AppState>(initialState)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    let mounted = true
    async function setup() {
      try {
        await initializeDatabase()
        if (!mounted) return
        dispatch({ type: 'DB_READY' })

        const success = await ModelManager.initialize((progress) => {
          if (!mounted) return
          dispatch({ type: 'MODEL_PROGRESS', progress })
        })

        if (!mounted) return
        if (success) {
          dispatch({ type: 'MODEL_READY' })
        } else {
          dispatch({ type: 'ERROR', message: 'Failed to initialize AI models' })
          dispatch({ type: 'MODEL_READY' })
        }
      } catch (err) {
        if (!mounted) return
        const msg = err instanceof Error ? err.message : 'Unknown error'
        dispatch({ type: 'ERROR', message: msg })
        // still mark as ready to avoid blocking
        dispatch({ type: 'DB_READY' })
        dispatch({ type: 'MODEL_READY' })
      }
    }
    setup()
    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo(() => state, [state])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  return useContext(AppContext)
}

