import { configureStore } from '@reduxjs/toolkit'
import { boardsSlice, filtersSlice, tasksSlice } from './slices'
import { readPersistedState } from './initialState'
import { syncMutation } from '../services/api'
import { enqueueApiSync } from '../services/syncQueue'
import { toast } from 'react-toastify'

const persisted = readPersistedState()
export const restoredFromLocalStorage = Boolean(persisted)
let showedOfflineNotice = false

const writeThroughMiddleware = ({ getState }) => (next) => (action) => {
  const result = next(action)
  if (/^(tasks\/(createTask|updateTask|deleteTask|moveTaskOnBoard|unassignTask)|boards\/(createCustomBoard|addList|deleteList|deleteCustomBoard))$/.test(action.type)) {
    const snapshot = getState()
    enqueueApiSync(() => syncMutation(action, snapshot)).then(() => {
      showedOfflineNotice = false
    }).catch(() => {
      if (!showedOfflineNotice) {
        showedOfflineNotice = true
        toast.warning('Saved on this device. Server sync will resume when the API is available.', { toastId: 'local-save-fallback' })
      }
    })
  }
  return result
}

export const store = configureStore({
  reducer: {
    boards: boardsSlice.reducer,
    tasks: tasksSlice.reducer,
    filters: filtersSlice.reducer,
  },
  preloadedState: persisted || undefined,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(writeThroughMiddleware),
})

export function persistWorkspace() {
  try {
    const { boards, tasks } = store.getState()
    localStorage.setItem('kanban-workspace-v1', JSON.stringify({ boards, tasks }))
  } catch {
    // The in-memory workspace remains usable if browser storage is unavailable.
  }
}

store.subscribe(persistWorkspace)
persistWorkspace()
