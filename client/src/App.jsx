import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Activity, ArrowUpDown, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, ClipboardList, Clock3, Filter, Inbox, LayoutGrid, ListPlus, Menu,
  MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, ArrowRight,
  UserRound, X,
} from 'lucide-react'
import { toast } from 'react-toastify'
import {
  addList, clearFilters, createCustomBoard, createTask, deleteCustomBoard, hydrateBoards, hydrateTasks,
  deleteList, deleteTask, moveTaskOnBoard, selectTasksByColumn, selectUnassignedTasks,
  selectVisibleTasks, setActiveBoard, setFilter, setSearchQuery, setSortBy,
  unassignTask, updateTask,
} from './store/slices'
import './App.css'
import { restoredFromLocalStorage } from './store/store'
import { loadRemoteWorkspace, mirrorWorkspaceSnapshot } from './services/api'
import { enqueueApiSync } from './services/syncQueue'

const priorityNames = { high: 'High', mid: 'Medium', low: 'Low' }
const statusNames = { todo: 'To do', 'in-progress': 'In progress', done: 'Completed' }
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'
const formatDate = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}
const dateIsOverdue = (value) => value && new Date(`${value}T23:59:59`) < new Date()

function App() {
  const dispatch = useDispatch()
  const boards = useSelector((state) => state.boards)
  const filters = useSelector((state) => state.filters)
  const tasks = useSelector((state) => state.tasks)
  const activeBoard = boards.byId[boards.activeBoardId]
  const visibleTasks = useSelector(selectVisibleTasks)
  const tasksByColumn = useSelector(selectTasksByColumn)
  const unassignedTasks = useSelector(selectUnassignedTasks)
  const [modal, setModal] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(filters.searchQuery)
  const [dropTarget, setDropTarget] = useState('')
  const [boardMenu, setBoardMenu] = useState(false)
  const filterRef = useRef(null)
  const sortRef = useRef(null)
  const initialSnapshot = useRef({ boards, tasks })
  const taskCount = tasks.allIds.length
  const doneCount = Object.values(tasks.byId).filter((task) => task.status === 'done').length
  const progress = taskCount ? Math.round((doneCount / taskCount) * 100) : 0

  useEffect(() => {
    const snapshot = initialSnapshot.current
    if (restoredFromLocalStorage) {
      enqueueApiSync(() => mirrorWorkspaceSnapshot(snapshot)).catch(() => {})
      return
    }
    let mounted = true
    loadRemoteWorkspace().then((remote) => {
      if (!mounted) return
      if (remote?.initialized && remote.boards?.byId && remote.tasks?.byId) {
        dispatch(hydrateBoards(remote.boards))
        dispatch(hydrateTasks(remote.tasks))
      } else {
        enqueueApiSync(() => mirrorWorkspaceSnapshot(snapshot)).catch(() => {})
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [dispatch])

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch(setSearchQuery(searchDraft)), 200)
    return () => window.clearTimeout(timer)
  }, [dispatch, searchDraft])

  useEffect(() => {
    const closePopovers = (event) => {
      if (!filterRef.current?.contains(event.target)) setFilterOpen(false)
      if (!sortRef.current?.contains(event.target)) setSortOpen(false)
      if (!event.target.closest('.board-more-wrap')) setBoardMenu(false)
    }
    window.addEventListener('mousedown', closePopovers)
    return () => window.removeEventListener('mousedown', closePopovers)
  }, [])

  useEffect(() => {
    setSearchDraft(filters.searchQuery)
  }, [filters.searchQuery])

  const handleBoardSelect = (id) => {
    dispatch(setActiveBoard(id))
    setDrawerOpen(false)
  }

  const handleDrop = (event, columnId) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain')
    setDropTarget('')
    if (!taskId || !columnId) return
    const task = tasks.byId[taskId]
    const existing = activeBoard.type === 'status'
      ? task?.status
      : activeBoard.type === 'priority'
        ? task?.priority
        : task?.customBoardPositions[activeBoard.id]
    if (existing === columnId) return
    dispatch(moveTaskOnBoard({ taskId, boardId: activeBoard.id, columnId }))
    toast.success(`Moved to ${activeBoard.columns.find((column) => column.id === columnId)?.title}`)
  }

  const handlePoolDrop = (event) => {
    event.preventDefault()
    setDropTarget('')
    const taskId = event.dataTransfer.getData('text/plain')
    if (!taskId) return
    const task = tasks.byId[taskId]
    if (activeBoard.type === 'custom') {
      if (task?.customBoardPositions[activeBoard.id]) {
        dispatch(unassignTask({ taskId, boardId: activeBoard.id }))
        toast.info('Task moved back to the unassigned pool')
      }
      return
    }
    if (task) setModal({ type: 'delete-task', task })
  }

  const filterableBoards = boards.allIds.map((id) => boards.byId[id]).filter((board) => board.id !== activeBoard.id)
  const currentFilterCount = [
    ...(activeBoard.type === 'status' ? [] : [filters.status]),
    ...(activeBoard.type === 'priority' ? [] : [filters.priority]),
    ...filterableBoards.map((board) => board.type === 'custom' ? filters.customBoards[board.id] || 'all' : 'all'),
  ].filter((value) => value !== 'all').length

  return (
    <div className="app-shell">
      {drawerOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
      <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><span /><span /><span /></div>
          <span className="brand-name">monday<span className="brand-dot">.</span></span>
          <button className="icon-button sidebar-collapse" aria-label="Collapse sidebar"><Menu size={18} /></button>
        </div>

        <button className="workspace-picker">
          <div className="workspace-avatar">S</div>
          <span className="workspace-copy"><strong>Studio North</strong><small>Free workspace</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="sidebar-nav-label">WORKSPACE</div>
        <button className="nav-item nav-item-active"><LayoutGrid size={17} /><span>Boards</span><span className="nav-count">{boards.allIds.length}</span></button>
        <button className="nav-item"><Inbox size={17} /><span>My tasks</span></button>
        <button className="nav-item"><Activity size={17} /><span>Activity</span></button>

        <div className="board-list-heading">
          <span className="sidebar-nav-label">YOUR BOARDS</span>
          <button className="icon-button tiny-button" aria-label="Create a board" onClick={() => setModal({ type: 'create-board' })}><Plus size={15} /></button>
        </div>
        <div className="board-nav-list">
          {boards.allIds.map((id) => {
            const board = boards.byId[id]
            const selected = board.id === activeBoard.id
            return (
              <div className={`board-nav-item ${selected ? 'board-nav-selected' : ''}`} key={board.id}>
                <button className="board-nav-link" onClick={() => handleBoardSelect(board.id)}>
                  <span className={`board-icon board-icon-${board.type}`}><ClipboardList size={15} /></span>
                  <span>{board.name}</span>
                </button>
                {board.type === 'custom' && <button className="board-nav-delete" aria-label={`Delete ${board.name}`} onClick={() => {
                  if (window.confirm(`Delete “${board.name}”? Its tasks will stay in your workspace.`)) {
                    dispatch(deleteCustomBoard(board.id))
                    toast.info('Board deleted')
                  }
                }}><MoreHorizontal size={16} /></button>}
              </div>
            )
          })}
        </div>
        <button className="new-board-link" onClick={() => setModal({ type: 'create-board' })}><span className="new-board-plus"><Plus size={14} /></span>Make a board</button>

        <div className="sidebar-spacer" />
        <div className="sidebar-progress-card">
          <div className="progress-card-top"><span className="progress-spark"><Sparkles size={15} /></span><span>Workspace progress</span><span className="progress-percent">{progress}%</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <p>{doneCount} of {taskCount} tasks completed</p>
        </div>
        <div className="sidebar-footer">
          <button className="nav-item"><CircleHelp size={17} /><span>Help & support</span></button>
          <button className="nav-item"><Settings2 size={17} /><span>Settings</span></button>
          <button className="profile-button"><span className="profile-avatar">AM</span><span className="profile-copy"><strong>Alex Morgan</strong><small>Workspace owner</small></span><MoreHorizontal size={18} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeBoard.name}</strong></div>
          <div className="topbar-spacer" />
          <button className="topbar-icon" aria-label="Notifications"><Bell size={18} /><i /></button>
          <button className="topbar-help" aria-label="Help"><CircleHelp size={18} /></button>
          <span className="topbar-avatar">AM</span>
        </header>

        <section className="board-header">
          <div className="board-title-area">
            <div className="board-eyebrow"><span className={`board-eyebrow-dot dot-${activeBoard.type}`} /> TEAM WORKSPACE <span className="eyebrow-divider">·</span> UPDATED JUST NOW</div>
            <div className="board-title-line">
              <h1>{activeBoard.name}</h1>
              <div className="board-more-wrap">
                <button className="icon-button board-more" aria-label="Board options" onClick={() => setBoardMenu(!boardMenu)}><MoreHorizontal size={19} /></button>
                {boardMenu && <div className="popover board-popover">
                  <button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.info('Board link copied'); setBoardMenu(false) }}>Copy board link</button>
                  {activeBoard.type === 'custom' && <button className="danger-option" onClick={() => {
                    if (window.confirm(`Delete “${activeBoard.name}”?`)) {
                      dispatch(deleteCustomBoard(activeBoard.id))
                      toast.info('Board deleted')
                    }
                    setBoardMenu(false)
                  }}><Trash2 size={14} /> Delete board</button>}
                </div>}
              </div>
            </div>
            <p className="board-description">A clear view of the work, the people, and what comes next.</p>
          </div>
          <div className="board-header-actions">
            <div className="avatar-stack" aria-label="Board members"><span className="stack-avatar stack-one">OR</span><span className="stack-avatar stack-two">PB</span><span className="stack-avatar stack-three">LW</span><button className="stack-add" aria-label="Invite member"><Plus size={14} /></button></div>
            <span className="member-count">+4</span>
            <span className="header-action-divider" />
            <button className="share-button" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Board link copied') }}><span className="share-dot" /> Share</button>
          </div>
        </section>

        <section className="toolbar">
          <div className="toolbar-left">
            <div className="search-wrap"><Search size={16} /><input aria-label="Search tasks" placeholder="Search tasks..." value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /><kbd>⌘ K</kbd></div>
            <div className="toolbar-popover-wrap" ref={filterRef}>
              <button className={`toolbar-button ${filterOpen || currentFilterCount ? 'toolbar-button-on' : ''}`} onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false) }}><SlidersHorizontal size={15} /> Filters{currentFilterCount > 0 && <span className="filter-count">{currentFilterCount}</span>}<ChevronDown size={14} /></button>
              {filterOpen && <div className="popover filter-popover">
                <div className="popover-title"><span>Filter tasks</span><button onClick={() => dispatch(clearFilters())}>Clear all</button></div>
                {activeBoard.type !== 'status' && <FilterSelect label="Status" value={filters.status} options={[['all', 'All statuses'], ['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Completed']]} onChange={(value) => dispatch(setFilter({ key: 'status', value }))} />}
                {activeBoard.type !== 'priority' && <FilterSelect label="Priority" value={filters.priority} options={[['all', 'All priorities'], ['high', 'High'], ['mid', 'Medium'], ['low', 'Low']]} onChange={(value) => dispatch(setFilter({ key: 'priority', value }))} />}
                {filterableBoards.filter((board) => board.type === 'custom').map((board) => <FilterSelect key={board.id} label={board.name} value={filters.customBoards[board.id] || 'all'} options={[
                  ['all', 'All lists'], ...board.columns.map((column) => [column.id, column.title]),
                ]} onChange={(value) => dispatch(setFilter({ key: 'customBoard', boardId: board.id, value }))} />)}
                {filterableBoards.filter((board) => board.type === 'custom').length === 0 && activeBoard.type === 'status' && <p className="filter-empty">Create another board to filter across your workspace.</p>}
                <div className="filter-rule-note"><Filter size={13} /> Filters only show boards other than the one you’re viewing.</div>
              </div>}
            </div>
            <div className="toolbar-popover-wrap" ref={sortRef}>
              <button className="toolbar-button" onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false) }}><ArrowUpDown size={15} /> Sort <ChevronDown size={14} /></button>
              {sortOpen && <div className="popover sort-popover">
                <p className="sort-label">SORT BY</p>
                {[
                  ['createdAt-desc', 'Recently created'], ['dueDate-asc', 'Due date · Earliest'], ['dueDate-desc', 'Due date · Latest'], ['priority-desc', 'Priority · Highest'],
                ].map(([value, label]) => <button className="sort-option" key={value} onClick={() => { dispatch(setSortBy(value)); setSortOpen(false) }}>{label}{filters.sortBy === value && <Check size={14} />}</button>)}
              </div>}
            </div>
          </div>
          <div className="toolbar-right"><span className="task-total">{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</span><button className="create-task-button" onClick={() => setModal({ type: 'task-form' })}><Plus size={16} /> Create task</button></div>
        </section>

        <div className="board-scroll-region">
          <div className={`board-canvas ${activeBoard.type === 'custom' ? 'canvas-with-pool' : ''}`}>
            {activeBoard.columns.map((column, index) => (
              <BoardColumn key={column.id} board={activeBoard} column={column} index={index} tasks={tasksByColumn[column.id] || []} isDropTarget={dropTarget === column.id} onDragEnter={() => setDropTarget(column.id)} onDragLeave={() => setDropTarget('')} onDrop={(event) => handleDrop(event, column.id)} onAddTask={() => setModal({ type: 'task-form', columnId: column.id })} onEdit={(task) => setModal({ type: 'task-form', task })} onDelete={(task) => setModal({ type: 'delete-task', task })} onMove={(taskId, columnId) => {
                dispatch(moveTaskOnBoard({ taskId, boardId: activeBoard.id, columnId }))
                toast.success(`Moved to ${activeBoard.columns.find((item) => item.id === columnId)?.title}`)
              }} onAddList={() => setModal({ type: 'add-list' })} onDeleteList={(id) => {
                if (activeBoard.columns.length <= 1) return toast.error('A board needs at least one list')
                const columnName = activeBoard.columns.find((item) => item.id === id)?.title
                if (window.confirm(`Delete “${columnName}”? Tasks in this list will return to the unassigned pool.`)) {
                  dispatch(deleteList({ boardId: activeBoard.id, columnId: id }))
                  toast.info('List deleted. Its tasks are now unassigned.')
                }
              }} />
            ))}
            {activeBoard.type === 'custom' ? (
              <aside className={`pool-column ${dropTarget === 'pool' ? 'pool-drop-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDropTarget('pool') }} onDragLeave={() => setDropTarget('')} onDrop={handlePoolDrop}>
                <div className="pool-heading"><div className="pool-title"><Inbox size={16} /><span>Unassigned</span><span className="column-count">{unassignedTasks.length}</span></div><span className="pool-label">POOL</span></div>
                <p className="pool-caption">Tasks not added to this board</p>
                <div className="pool-cards">
                  {unassignedTasks.length ? unassignedTasks.map((task) => <TaskCard key={task.id} task={task} board={activeBoard} onMove={(columnId) => {
                    dispatch(moveTaskOnBoard({ taskId: task.id, boardId: activeBoard.id, columnId }))
                    toast.success(`Added to ${activeBoard.columns.find((column) => column.id === columnId)?.title}`)
                  }} onEdit={() => setModal({ type: 'task-form', task })} onDelete={() => setModal({ type: 'delete-task', task })} />) : <div className="pool-empty"><div className="empty-inbox"><Inbox size={20} /></div><strong>All caught up</strong><p>Tasks you haven’t added to this board will show up here.</p></div>}
                </div>
              </aside>
            ) : (
              <aside className={`pool-column system-pool ${dropTarget === 'pool' ? 'pool-drop-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDropTarget('pool') }} onDragLeave={() => setDropTarget('')} onDrop={handlePoolDrop}>
                <div className="pool-heading"><div className="pool-title"><Inbox size={16} /><span>Remaining</span></div><span className="pool-label">ALL SET</span></div>
                <div className="system-empty"><div className="empty-check"><Check size={20} /></div><strong>No tasks remaining</strong><p>Every task has a {activeBoard.type === 'status' ? 'status' : 'priority'} on this board.</p><span>Drop here to delete a task</span></div>
              </aside>
            )}
          </div>
        </div>
        <footer className="workspace-footer"><span><span className="status-indicator" /> Changes saved locally</span><span>{taskCount} tasks <span className="footer-divider">·</span> {boards.allIds.length} boards</span></footer>
      </main>

      {modal?.type === 'task-form' && <TaskFormModal key={modal.task?.id || 'new-task'} task={modal.task} initialColumn={modal.columnId} boards={boards} activeBoard={activeBoard} onClose={() => setModal(null)} onSave={(values) => {
        if (modal.task) {
          dispatch(updateTask({ id: modal.task.id, changes: values }))
          toast.success('Task updated')
        } else {
          dispatch(createTask(values))
          toast.success('Task created')
        }
        setModal(null)
      }} />}
      {modal?.type === 'create-board' && <CreateBoardModal onClose={() => setModal(null)} onCreate={(name, listTitles) => {
        dispatch(createCustomBoard({ name, listTitles }))
        toast.success('Your new board is ready')
        setModal(null)
      }} />}
      {modal?.type === 'add-list' && <SimpleFormModal title="Add a list" description={`Add a new stage to ${activeBoard.name}.`} submitLabel="Add list" onClose={() => setModal(null)} onSubmit={(value) => {
        if (!value.trim()) return
        dispatch(addList({ boardId: activeBoard.id, title: value }))
        toast.success('List added')
        setModal(null)
      }} />}
      {modal?.type === 'delete-task' && <DeleteTaskModal task={modal.task} board={activeBoard} onClose={() => setModal(null)} onUnassign={() => {
        dispatch(unassignTask({ taskId: modal.task.id, boardId: activeBoard.id }))
        toast.info('Task removed from this board')
        setModal(null)
      }} onDelete={() => {
        dispatch(deleteTask(modal.task.id))
        toast.success('Task deleted permanently')
        setModal(null)
      }} />}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}</select></label>
}

function BoardColumn({ board, column, index, tasks, isDropTarget, onDragEnter, onDragLeave, onDrop, onAddTask, onEdit, onDelete, onMove, onAddList, onDeleteList }) {
  const columnIcon = board.type === 'status' ? ['○', '◉', '✓'][index % 3] : board.type === 'priority' ? ['↑', '↗', '↓'][index % 3] : ''
  const headerTone = board.type === 'priority' ? `priority-header-${column.id}` : board.type === 'status' ? `status-header-${column.id}` : 'custom-header'
  return (
    <section className={`board-column ${isDropTarget ? 'column-drop-active' : ''}`} onDragOver={(event) => event.preventDefault()} onDragEnter={onDragEnter} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onDragLeave() }} onDrop={onDrop}>
      <div className={`column-heading ${headerTone}`}>
        <div className="column-title-line"><span className={`column-marker marker-${column.id}`}>{columnIcon}</span><h2>{column.title}</h2><span className="column-count">{tasks.length}</span></div>
        <div className="column-actions">
          {board.type === 'custom' && <button className="column-icon-button column-delete" aria-label={`Delete ${column.title}`} title="Delete list" onClick={() => onDeleteList(column.id)}><Trash2 size={14} /></button>}
          <button className="column-icon-button" aria-label={`Add task to ${column.title}`} title="Add task" onClick={onAddTask}><Plus size={16} /></button>
        </div>
      </div>
      <div className="column-divider" />
      <div className="column-cards">
        {tasks.map((task) => <TaskCard key={task.id} task={task} board={board} onMove={(columnId) => onMove(task.id, columnId)} onEdit={() => onEdit(task)} onDelete={() => onDelete(task)} />)}
        {tasks.length === 0 && <div className="column-empty"><span className="empty-plus"><Plus size={14} /></span><span>No tasks yet</span></div>}
      </div>
      <button className="column-add-task" onClick={onAddTask}><Plus size={15} /><span>Add task</span></button>
      {board.type === 'custom' && index === board.columns.length - 1 && <button className="add-list-button" onClick={onAddList}><ListPlus size={15} /> Add list</button>}
    </section>
  )
}

function TaskCard({ task, board, onMove, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const currentColumn = board?.type === 'status' ? task.status : board?.type === 'priority' ? task.priority : task.customBoardPositions[board?.id]
  return (
    <article className={`task-card task-${task.color || 'lavender'}`} draggable onDragStart={(event) => {
      event.dataTransfer.setData('text/plain', task.id)
      event.dataTransfer.effectAllowed = 'move'
      event.currentTarget.classList.add('is-dragging')
    }} onDragEnd={(event) => event.currentTarget.classList.remove('is-dragging')}>
      <div className="task-card-top"><span className={`priority-tag priority-${task.priority}`}><span />{priorityNames[task.priority]}</span><div className="task-menu-wrap"><button className="task-menu-button" aria-label="Task options" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={18} /></button>{menuOpen && <><button className="menu-dismiss" aria-label="Close menu" onClick={() => setMenuOpen(false)} /><div className="popover task-popover">
        {board && onMove && <label className="quick-move"><ArrowRight size={13} /><select aria-label="Move task to list" value={currentColumn || ''} onChange={(event) => { onMove(event.target.value); setMenuOpen(false) }}><option value="" disabled>Move to…</option>{board.columns.map((column) => <option value={column.id} key={column.id}>{column.title}</option>)}</select></label>}
        <button onClick={() => { onEdit(); setMenuOpen(false) }}>Edit task</button><button className="danger-option" onClick={() => { onDelete(); setMenuOpen(false) }}><Trash2 size={14} /> Delete task</button></div></>}</div></div>
      <button className="task-title-button" onClick={onEdit}><h3>{task.title}</h3></button>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-meta-row">
        {task.dueDate ? <span className={`task-due ${dateIsOverdue(task.dueDate) ? 'is-overdue' : ''}`}><CalendarDays size={13} />{formatDate(task.dueDate)}</span> : <span className="task-due no-date"><Clock3 size={13} />No due date</span>}
        <span className="task-avatar" title={task.assignee || 'Unassigned'}>{task.assignee ? initials(task.assignee) : <UserRound size={13} />}</span>
      </div>
    </article>
  )
}

function ModalFrame({ title, description, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</section></div>
}

function TaskFormModal({ task, initialColumn, boards, activeBoard, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState(task?.status || (activeBoard.type === 'status' ? initialColumn || 'todo' : 'todo'))
  const [priority, setPriority] = useState(task?.priority || (activeBoard.type === 'priority' ? initialColumn || 'mid' : 'mid'))
  const [dueDate, setDueDate] = useState(task?.dueDate || '')
  const [assignee, setAssignee] = useState(task?.assignee || '')
  const [errors, setErrors] = useState('')
  const customBoards = boards.allIds.map((id) => boards.byId[id]).filter((board) => board.type === 'custom')
  const [positions, setPositions] = useState(() => {
    const result = { ...(task?.customBoardPositions || {}) }
    if (!task && activeBoard.type === 'custom') result[activeBoard.id] = initialColumn || activeBoard.columns[0]?.id
    return result
  })
  const save = (event) => {
    event.preventDefault()
    if (!title.trim()) return setErrors('Give your task a name before saving.')
    onSave({ title, description, status, priority, dueDate, assignee, customBoardPositions: positions })
  }
  return <ModalFrame title={task ? 'Edit task' : 'Create a task'} description={task ? 'Update the details and keep everyone in the loop.' : 'Add a little context so the team knows what’s next.'} onClose={onClose} wide>
    <form className="task-form" onSubmit={save}>
      <label className="form-field"><span>Task name <i>*</i></span><input autoFocus placeholder="e.g. Prepare the launch plan" value={title} onChange={(event) => { setTitle(event.target.value); setErrors('') }} /></label>
      {errors && <p className="form-error">{errors}</p>}
      <label className="form-field"><span>Description</span><textarea placeholder="Add more detail, links, or helpful context..." rows="3" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="form-grid">
        <label className="form-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(statusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}>{Object.entries(priorityNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="form-field"><span>Assignee</span><input placeholder="Name" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
      </div>
      {customBoards.length > 0 && <div className="board-assignment-fields"><div className="assignment-heading"><span>Custom board placement</span><small>Optional · Add this task to other boards</small></div><div className="form-grid">{customBoards.map((board) => <label className="form-field" key={board.id}><span>{board.name}</span><select value={positions[board.id] || 'unassigned'} onChange={(event) => setPositions((current) => {
        const next = { ...current }
        if (event.target.value === 'unassigned') delete next[board.id]
        else next[board.id] = event.target.value
        return next
      })}><option value="unassigned">Not on this board</option>{board.columns.map((column) => <option value={column.id} key={column.id}>{column.title}</option>)}</select></label>)}</div></div>}
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">{task ? 'Save changes' : 'Create task'}</button></div>
    </form>
  </ModalFrame>
}

function CreateBoardModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [listTitles, setListTitles] = useState(['To do', 'In progress', 'Completed'])
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const titles = listTitles.map((title) => title.trim()).filter(Boolean)
    if (!name.trim()) return setError('Enter a name for your board.')
    if (titles.length < 1) return setError('Add at least one list.')
    onCreate(name, titles)
  }
  return <ModalFrame title="Make a board" description="Set up a space that works the way your team does." onClose={onClose}>
    <form className="task-form board-form" onSubmit={submit}>
      <label className="form-field"><span>Board name <i>*</i></span><input autoFocus placeholder="e.g. Marketing projects" value={name} onChange={(event) => { setName(event.target.value); setError('') }} /></label>
      <div className="list-editor-heading"><span>Starting lists</span><button type="button" className="text-button" onClick={() => setListTitles((current) => [...current, ''])}><Plus size={14} /> Add a list</button></div>
      <div className="list-editor">{listTitles.map((title, index) => <div className="list-editor-row" key={index}><span className="list-editor-grip">⠿</span><input aria-label={`List ${index + 1}`} placeholder={`List ${index + 1}`} value={title} onChange={(event) => setListTitles((current) => current.map((item, i) => i === index ? event.target.value : item))} /><button type="button" className="icon-button" aria-label="Remove list" onClick={() => setListTitles((current) => current.filter((_, i) => i !== index))}><X size={15} /></button></div>)}</div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">Create board</button></div>
    </form>
  </ModalFrame>
}

function SimpleFormModal({ title, description, submitLabel, onClose, onSubmit }) {
  const [value, setValue] = useState('')
  return <ModalFrame title={title} description={description} onClose={onClose}><form className="task-form" onSubmit={(event) => { event.preventDefault(); onSubmit(value) }}><label className="form-field"><span>List name</span><input autoFocus placeholder="e.g. In review" value={value} onChange={(event) => setValue(event.target.value)} /></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">{submitLabel}</button></div></form></ModalFrame>
}

function DeleteTaskModal({ task, board, onClose, onUnassign, onDelete }) {
  const isCustom = board.type === 'custom'
  return <ModalFrame title={isCustom ? 'Remove this task?' : 'Delete this task?'} description={isCustom ? 'Choose whether to remove it from this board or from your whole workspace.' : 'This task will be permanently removed from every board.'} onClose={onClose}>
    <div className="delete-task-summary"><span className={`priority-tag priority-${task.priority}`}><span />{priorityNames[task.priority]}</span><strong>{task.title}</strong></div>
    <div className="delete-modal-actions"><button className="button-secondary" onClick={onClose}>Cancel</button>{isCustom && <button className="button-secondary" onClick={onUnassign}>Remove from this board only</button>}<button className="button-danger" onClick={onDelete}>Delete permanently</button></div>
  </ModalFrame>
}

export default App
