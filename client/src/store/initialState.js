const now = Date.now()
const day = 24 * 60 * 60 * 1000

export const starterBoards = {
  byId: {
    'board-status': {
      id: 'board-status',
      name: 'Status board',
      type: 'status',
      columns: [
        { id: 'todo', title: 'To do' },
        { id: 'in-progress', title: 'In progress' },
        { id: 'done', title: 'Completed' },
      ],
      createdAt: now - 3,
    },
    'board-priority': {
      id: 'board-priority',
      name: 'Priority',
      type: 'priority',
      columns: [
        { id: 'high', title: 'High' },
        { id: 'mid', title: 'Medium' },
        { id: 'low', title: 'Low' },
      ],
      createdAt: now - 2,
    },
  },
  allIds: ['board-status', 'board-priority'],
  activeBoardId: 'board-status',
}

export const starterTasks = {
  byId: {
    'task-1': {
      id: 'task-1',
      title: 'Map out the product launch',
      description: 'Align the key milestones and owners for the upcoming launch.',
      status: 'in-progress',
      priority: 'high',
      customBoardPositions: {},
      dueDate: new Date(now + day * 2).toISOString().slice(0, 10),
      createdAt: now - day * 2,
      updatedAt: now - day,
      assignee: 'Olivia Rhye',
      color: 'lavender',
    },
    'task-2': {
      id: 'task-2',
      title: 'Draft the welcome email',
      description: 'Write a warm first-touch email for new customers.',
      status: 'todo',
      priority: 'mid',
      customBoardPositions: {},
      dueDate: new Date(now + day * 4).toISOString().slice(0, 10),
      createdAt: now - day,
      updatedAt: now - day,
      assignee: 'Phoenix Baker',
      color: 'peach',
    },
    'task-3': {
      id: 'task-3',
      title: 'Review onboarding flow',
      description: 'Check the new user journey and note any rough edges.',
      status: 'todo',
      priority: 'high',
      customBoardPositions: {},
      dueDate: new Date(now + day).toISOString().slice(0, 10),
      createdAt: now - day * 3,
      updatedAt: now - day * 2,
      assignee: 'Lana Steiner',
      color: 'blue',
    },
    'task-4': {
      id: 'task-4',
      title: 'Collect customer feedback',
      description: 'Pull together recent feedback from calls and support.',
      status: 'in-progress',
      priority: 'low',
      customBoardPositions: {},
      dueDate: '',
      createdAt: now - day * 5,
      updatedAt: now - day * 2,
      assignee: 'Demi Wilkinson',
      color: 'mint',
    },
    'task-5': {
      id: 'task-5',
      title: 'Ship the dashboard refresh',
      description: 'Final polish and QA for the updated workspace dashboard.',
      status: 'done',
      priority: 'mid',
      customBoardPositions: {},
      dueDate: new Date(now - day).toISOString().slice(0, 10),
      createdAt: now - day * 6,
      updatedAt: now - day,
      assignee: 'Candice Wu',
      color: 'rose',
    },
  },
  allIds: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'],
}

export const starterFilters = {
  searchQuery: '',
  sortBy: 'createdAt-desc',
  status: 'all',
  priority: 'all',
  customBoards: {},
}

export function readPersistedState() {
  try {
    const saved = JSON.parse(localStorage.getItem('kanban-workspace-v1'))
    if (!saved?.boards?.byId || !saved?.tasks?.byId) return null
    const validBoardIds = saved.boards.allIds.filter((id) => saved.boards.byId[id])
    if (!validBoardIds.length) return null
    return {
      boards: {
        ...saved.boards,
        allIds: validBoardIds,
        activeBoardId: saved.boards.byId[saved.boards.activeBoardId]
          ? saved.boards.activeBoardId
          : validBoardIds[0],
      },
      tasks: {
        ...saved.tasks,
        allIds: saved.tasks.allIds.filter((id) => saved.tasks.byId[id]),
      },
    }
  } catch {
    return null
  }
}
