const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      throw new Error(detail.error || `Request failed (${response.status})`)
    }
    if (response.status === 204) return null
    return response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

export function loadRemoteWorkspace() {
  return request('/api/state')
}

export function mirrorWorkspaceSnapshot(snapshot) {
  return request('/api/state', { method: 'PUT', body: JSON.stringify(snapshot) })
}

export function syncMutation(action, state) {
  const { tasks, boards } = state
  switch (action.type) {
    case 'tasks/createTask': {
      const task = tasks.byId[action.payload.id]
      return request('/api/tasks', { method: 'POST', body: JSON.stringify(task) })
    }
    case 'tasks/updateTask':
    case 'tasks/moveTaskOnBoard':
    case 'tasks/unassignTask': {
      const taskId = action.payload.id || action.payload.taskId
      return request(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PUT', body: JSON.stringify(tasks.byId[taskId]) })
    }
    case 'tasks/deleteTask':
      return request(`/api/tasks/${encodeURIComponent(action.payload)}`, { method: 'DELETE' })
    case 'boards/createCustomBoard': {
      const board = boards.byId[action.payload.id]
      return request('/api/boards', { method: 'POST', body: JSON.stringify(board) })
    }
    case 'boards/addList':
    case 'boards/deleteList': {
      const board = boards.byId[action.payload.boardId]
      return request(`/api/boards/${encodeURIComponent(board.id)}`, {
        method: 'PUT', body: JSON.stringify({ name: board.name, columns: board.columns }),
      })
    }
    case 'boards/deleteCustomBoard':
      return request(`/api/boards/${encodeURIComponent(action.payload)}`, { method: 'DELETE' })
    default:
      return Promise.resolve()
  }
}

