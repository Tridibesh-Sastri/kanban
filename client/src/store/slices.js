import { createSlice, createSelector, nanoid } from '@reduxjs/toolkit'
import { starterBoards, starterFilters, starterTasks } from './initialState'

export const boardsSlice = createSlice({
  name: 'boards',
  initialState: starterBoards,
  reducers: {
    hydrateBoards(state, action) {
      return action.payload
    },
    setActiveBoard(state, action) {
      if (state.byId[action.payload]) state.activeBoardId = action.payload
    },
    createCustomBoard: {
      reducer(state, action) {
        const board = action.payload
        state.byId[board.id] = board
        state.allIds.push(board.id)
        state.activeBoardId = board.id
      },
      prepare({ name, listTitles }) {
        const id = `board-${nanoid(8)}`
        return {
          payload: {
            id,
            name: name.trim(),
            type: 'custom',
            columns: listTitles.map((title) => ({ id: `list-${nanoid(6)}`, title: title.trim() })),
            createdAt: Date.now(),
          },
        }
      },
    },
    addList: {
      reducer(state, action) {
        const board = state.byId[action.payload.boardId]
        if (board?.type === 'custom') board.columns.push(action.payload.column)
      },
      prepare({ boardId, title }) {
        return { payload: { boardId, column: { id: `list-${nanoid(6)}`, title: title.trim() } } }
      },
    },
    deleteList(state, action) {
      const board = state.byId[action.payload.boardId]
      if (board?.type === 'custom' && board.columns.length > 1) {
        board.columns = board.columns.filter((column) => column.id !== action.payload.columnId)
      }
    },
    deleteCustomBoard(state, action) {
      const board = state.byId[action.payload]
      if (board?.type !== 'custom') return
      delete state.byId[action.payload]
      state.allIds = state.allIds.filter((id) => id !== action.payload)
      if (state.activeBoardId === action.payload) state.activeBoardId = 'board-status'
    },
  },
})

export const tasksSlice = createSlice({
  name: 'tasks',
  initialState: starterTasks,
  reducers: {
    hydrateTasks(state, action) {
      return action.payload
    },
    createTask: {
      reducer(state, action) {
        state.byId[action.payload.id] = action.payload
        state.allIds.unshift(action.payload.id)
      },
      prepare(task) {
        const timestamp = Date.now()
        return {
          payload: {
            id: `task-${nanoid(8)}`,
            title: task.title.trim(),
            description: task.description.trim(),
            status: task.status || 'todo',
            priority: task.priority || 'mid',
            customBoardPositions: task.customBoardPositions || {},
            dueDate: task.dueDate || '',
            assignee: task.assignee?.trim() || '',
            color: task.color || 'lavender',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        }
      },
    },
    updateTask(state, action) {
      const task = state.byId[action.payload.id]
      if (!task) return
      Object.assign(task, action.payload.changes, { updatedAt: Date.now() })
    },
    deleteTask(state, action) {
      delete state.byId[action.payload]
      state.allIds = state.allIds.filter((id) => id !== action.payload)
    },
    moveTaskOnBoard(state, action) {
      const task = state.byId[action.payload.taskId]
      if (!task) return
      const { boardId, columnId } = action.payload
      if (boardId === 'board-status') task.status = columnId
      else if (boardId === 'board-priority') task.priority = columnId
      else task.customBoardPositions[boardId] = columnId
      task.updatedAt = Date.now()
    },
    unassignTask(state, action) {
      const task = state.byId[action.payload.taskId]
      if (!task) return
      delete task.customBoardPositions[action.payload.boardId]
      task.updatedAt = Date.now()
    },
  },
  extraReducers(builder) {
    builder
      .addCase(boardsSlice.actions.deleteCustomBoard, (state, action) => {
        for (const task of Object.values(state.byId)) delete task.customBoardPositions[action.payload]
      })
      .addCase(boardsSlice.actions.deleteList, (state, action) => {
        const { boardId, columnId } = action.payload
        for (const task of Object.values(state.byId)) {
          if (task.customBoardPositions[boardId] === columnId) delete task.customBoardPositions[boardId]
        }
      })
  },
})

export const filtersSlice = createSlice({
  name: 'filters',
  initialState: starterFilters,
  reducers: {
    setSearchQuery(state, action) {
      state.searchQuery = action.payload
    },
    setSortBy(state, action) {
      state.sortBy = action.payload
    },
    setFilter(state, action) {
      const { key, value, boardId } = action.payload
      if (key === 'customBoard') state.customBoards[boardId] = value
      else state[key] = value
    },
    clearFilters(state) {
      state.status = 'all'
      state.priority = 'all'
      state.customBoards = {}
    },
  },
  extraReducers(builder) {
    builder.addCase(boardsSlice.actions.setActiveBoard, (state, action) => {
      if (action.payload === 'board-status') state.status = 'all'
      else if (action.payload === 'board-priority') state.priority = 'all'
      else state.customBoards[action.payload] = 'all'
    })
  },
})

export const selectVisibleTasks = createSelector(
  [(state) => state.tasks, (state) => state.boards, (state) => state.filters],
  (tasks, boards, filters) => {
    const board = boards.byId[boards.activeBoardId]
    const activeBoardType = board?.type
    const priorityFilter = activeBoardType === 'priority' ? 'all' : filters.priority
    const statusFilter = activeBoardType === 'status' ? 'all' : filters.status
    const customBoardFilters = Object.entries(filters.customBoards).filter(([id]) => id !== boards.activeBoardId)
    const ordered = tasks.allIds
      .map((id) => tasks.byId[id])
      .filter(Boolean)
      .filter((task) => !filters.searchQuery || task.title.toLowerCase().includes(filters.searchQuery.toLowerCase()))
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter((task) => customBoardFilters.every(([id, value]) => value === 'all' || task.customBoardPositions[id] === value))

    const priorityRank = { high: 3, mid: 2, low: 1 }
    ordered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'dueDate-asc': return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
        case 'dueDate-desc': return (b.dueDate || '').localeCompare(a.dueDate || '')
        case 'priority-desc': return priorityRank[b.priority] - priorityRank[a.priority]
        case 'createdAt-desc':
        default: return b.createdAt - a.createdAt
      }
    })
    return ordered
  },
)

export const selectUnassignedTasks = createSelector(
  [selectVisibleTasks, (state) => state.boards],
  (tasks, boards) => {
    const board = boards.byId[boards.activeBoardId]
    if (!board || board.type !== 'custom') return []
    return tasks.filter((task) => !task.customBoardPositions[board.id])
  },
)

export const selectTasksByColumn = createSelector(
  [selectVisibleTasks, (state) => state.boards],
  (tasks, boards) => {
    const board = boards.byId[boards.activeBoardId]
    const taskColumn = (task) => board?.type === 'status'
      ? task.status
      : board?.type === 'priority'
        ? task.priority
        : task.customBoardPositions[board.id]
    return Object.fromEntries((board?.columns || []).map((column) => [column.id, tasks.filter((task) => taskColumn(task) === column.id)]))
  },
)

export const { hydrateBoards, setActiveBoard, createCustomBoard, addList, deleteList, deleteCustomBoard } = boardsSlice.actions
export const { hydrateTasks, createTask, updateTask, deleteTask, moveTaskOnBoard, unassignTask } = tasksSlice.actions
export const { setSearchQuery, setSortBy, setFilter, clearFilters } = filtersSlice.actions

