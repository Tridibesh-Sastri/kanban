import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.join(__dirname, 'data')
const dataFile = path.join(dataDirectory, 'workspace.json')
const app = express()
const port = Number(process.env.PORT) || 3001

const defaultState = () => {
  const createdAt = Date.now()
  const statusBoard = {
    id: 'board-status', name: 'Status board', type: 'status', createdAt: createdAt - 1,
    columns: [{ id: 'todo', title: 'To do' }, { id: 'in-progress', title: 'In progress' }, { id: 'done', title: 'Completed' }],
  }
  const priorityBoard = {
    id: 'board-priority', name: 'Priority', type: 'priority', createdAt,
    columns: [{ id: 'high', title: 'High' }, { id: 'mid', title: 'Medium' }, { id: 'low', title: 'Low' }],
  }
  return {
    initialized: false,
    boards: { byId: { [statusBoard.id]: statusBoard, [priorityBoard.id]: priorityBoard }, allIds: [statusBoard.id, priorityBoard.id], activeBoardId: statusBoard.id },
    tasks: { byId: {}, allIds: [] },
  }
}

fs.mkdirSync(dataDirectory, { recursive: true })
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(defaultState(), null, 2))

function readState() {
  try {
    const value = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    if (value?.boards?.byId && value?.tasks?.byId) return value
  } catch (error) {
    console.error('Unable to read workspace data; restoring defaults.', error)
  }
  const value = defaultState()
  writeState(value, false)
  return value
}

function writeState(state, initialized = true) {
  state.initialized = initialized
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2))
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/state', (_request, response) => {
  const { boards, tasks, initialized } = readState()
  response.json({ boards, tasks, initialized: Boolean(initialized) })
})
app.get('/api/boards', (_request, response) => response.json(readState().boards))
app.get('/api/tasks', (_request, response) => response.json(readState().tasks))

app.put('/api/state', (request, response) => {
  const { boards, tasks } = request.body || {}
  if (!boards?.byId || !Array.isArray(boards.allIds) || !tasks?.byId || !Array.isArray(tasks.allIds)) {
    return response.status(400).json({ error: 'A normalized boards and tasks snapshot is required.' })
  }
  const boardIds = boards.allIds.filter((id) => boards.byId[id])
  const taskIds = tasks.allIds.filter((id) => tasks.byId[id])
  if (!boardIds.length) return response.status(400).json({ error: 'At least one board is required.' })
  const safeBoards = {
    byId: Object.fromEntries(boardIds.map((id) => [id, boards.byId[id]])),
    allIds: boardIds,
    activeBoardId: boards.byId[boards.activeBoardId] ? boards.activeBoardId : boardIds[0],
  }
  const safeTasks = { byId: Object.fromEntries(taskIds.map((id) => [id, tasks.byId[id]])), allIds: taskIds }
  writeState({ boards: safeBoards, tasks: safeTasks })
  return response.json({ boards: safeBoards, tasks: safeTasks, initialized: true })
})

app.post('/api/boards', (request, response) => {
  const { id, name, columns, createdAt } = request.body || {}
  if (!id || !name?.trim() || !Array.isArray(columns) || columns.length < 1) {
    return response.status(400).json({ error: 'A board id, name, and at least one list are required.' })
  }
  const state = readState()
  if (state.boards.byId[id]) return response.status(409).json({ error: 'A board with this id already exists.' })
  const board = { id, name: name.trim(), type: 'custom', columns, createdAt: createdAt || Date.now() }
  state.boards.byId[id] = board
  state.boards.allIds.push(id)
  writeState(state)
  return response.status(201).json(board)
})

app.put('/api/boards/:boardId', (request, response) => {
  const state = readState()
  const board = state.boards.byId[request.params.boardId]
  if (!board || board.type !== 'custom') return response.status(404).json({ error: 'Custom board not found.' })
  const { name, columns } = request.body || {}
  if (name !== undefined && !name.trim()) return response.status(400).json({ error: 'Board name cannot be blank.' })
  if (columns !== undefined && (!Array.isArray(columns) || columns.length < 1)) {
    return response.status(400).json({ error: 'A board must have at least one list.' })
  }
  const removedColumns = columns ? board.columns.filter((column) => !columns.some((next) => next.id === column.id)).map((column) => column.id) : []
  if (name !== undefined) board.name = name.trim()
  if (columns !== undefined) board.columns = columns
  for (const task of Object.values(state.tasks.byId)) {
    if (removedColumns.includes(task.customBoardPositions?.[board.id])) delete task.customBoardPositions[board.id]
  }
  writeState(state)
  return response.json(board)
})

app.delete('/api/boards/:boardId', (request, response) => {
  const state = readState()
  const board = state.boards.byId[request.params.boardId]
  if (board && board.type !== 'custom') return response.status(403).json({ error: 'System boards cannot be deleted.' })
  if (!board) return response.status(204).end()
  delete state.boards.byId[board.id]
  state.boards.allIds = state.boards.allIds.filter((id) => id !== board.id)
  if (state.boards.activeBoardId === board.id) state.boards.activeBoardId = 'board-status'
  for (const task of Object.values(state.tasks.byId)) delete task.customBoardPositions?.[board.id]
  writeState(state)
  return response.status(204).end()
})

app.post('/api/tasks', (request, response) => {
  const task = request.body
  if (!task?.id || !task.title?.trim() || !task.status || !task.priority) {
    return response.status(400).json({ error: 'A task id, title, status, and priority are required.' })
  }
  const state = readState()
  if (state.tasks.byId[task.id]) return response.status(409).json({ error: 'A task with this id already exists.' })
  state.tasks.byId[task.id] = { ...task, title: task.title.trim(), customBoardPositions: task.customBoardPositions || {} }
  state.tasks.allIds.unshift(task.id)
  writeState(state)
  return response.status(201).json(state.tasks.byId[task.id])
})

app.put('/api/tasks/:taskId', (request, response) => {
  const state = readState()
  const taskId = request.params.taskId
  const existing = state.tasks.byId[taskId]
  const nextTask = { ...(existing || {}), ...request.body, id: taskId, updatedAt: request.body?.updatedAt || Date.now() }
  if (!nextTask.title?.trim() || !nextTask.status || !nextTask.priority) {
    return response.status(400).json({ error: 'A task title, status, and priority are required.' })
  }
  nextTask.customBoardPositions ||= {}
  state.tasks.byId[taskId] = nextTask
  if (!state.tasks.allIds.includes(taskId)) state.tasks.allIds.unshift(taskId)
  writeState(state)
  return response.json(nextTask)
})

app.delete('/api/tasks/:taskId', (request, response) => {
  const state = readState()
  delete state.tasks.byId[request.params.taskId]
  state.tasks.allIds = state.tasks.allIds.filter((id) => id !== request.params.taskId)
  writeState(state)
  return response.status(204).end()
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
})

app.listen(port, () => console.log(`Kanban API listening on http://localhost:${port}`))
