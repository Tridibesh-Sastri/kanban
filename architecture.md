Every read, search, sort, and $N - 1$ cross-board filter operation will run in-memory against your Redux store (`allTasks` and `allBoards`), while every write mutation (`create`, `update`, `delete`, `moveTask`, `unassignTask`, `createBoard`, `addList`, `deleteList`) will execute a **Write-Through Persistence Pipeline** that updates Redux immediately, writes to `localStorage` synchronously, and syncs with your Express backend API with **`react-toastify`** notifications.

Below are your two ready-to-use deliverables:

1. **`ARCHITECTURE.md`**: Save this file in your project root so Google Antigravity can reference the exact Low-Level Design (LLD) contracts, component tree (`LeftBarComponent`, `RightBarComponent`, `TopNavComponent`, `ListComponent`, `TaskCardComponent`, `BoardCardComponent`), and API specifications.


2. **Master Prompt for Google Antigravity**: Copy and paste this directly into Google Antigravity to build the entire application inside your existing `./client` (Vite React JavaScript) and `./server` (Express) workspace.

---

### File 1: Save as `ARCHITECTURE.md`

```markdown
# Multi-Board Kanban Workspace — Low-Level Design & Architecture (ARCHITECTURE.md)

## 1. Project Context & Tech Stack
- **Frontend (`./client`):** Already initialized via `npm create vite@latest` using **React + JavaScript (ES6+ / JSX)** (No TypeScript).
  - **State Management:** `@reduxjs/toolkit`, `react-redux`
  - **Styling & Icons:** `tailwindcss` (`@tailwindcss/vite`), `lucide-react`
  - **Notifications & Network:** `react-toastify`, `axios`
- **Backend (`./server`):** **Node.js + Express.js** REST API (`express`, `cors`, `dotenv`, `nodemon`) with persistent JSON file storage (and modular controller structure ready for MongoDB/Mongoose swap).

---

## 2. Core Architectural Principles

### A. Why Redux Toolkit Over React Context API?
1. **Granular Re-renders on Drag-and-Drop:** Moving a single task card updates only one entry in `allTasks.byId`. With Context API, every column (`ListComponent`) and card (`TaskCardComponent`) would re-render on every drop. Redux Toolkit selectors only re-render the affected column(s).
2. **Memoized In-Memory Filtering (`createSelector`):** Searching, sorting, $N - 1$ cross-board filtering, and calculating the `RightBarComponent` unassigned task pool happen 100% in frontend memory in a single $O(N)$ pass without mutating the source-of-truth state or making redundant network calls.
3. **Centralized Write-Through Persistence:** Redux Toolkit allows intercepting every write action (task/board creation, edits, column moves, list additions) to immediately persist the updated `allTasks` and `allBoards` maps to `localStorage` and sync with the Express API.

### B. Write-Through Persistence Pipeline (Zero Data Loss Guarantee)
- **Read Path (0ms Latency):**
  `UI Components` ➔ `Memoized Redux Selectors` ➔ `Redux Store (allTasks & allBoards)`
- **Write Path (Dual Persistence):**
  `User Mutation (Add/Edit/Delete/Drag-Drop/Add List)`
  ➔ `1. Dispatch Redux Action (Optimistic UI Update in Store)`
  ➔ `2. Store Subscriber writes updated state to localStorage immediately`
  ➔ `3. Async API Service syncs mutation to Express Backend (/api/tasks or /api/boards)`
  ➔ `4. Trigger react-toastify feedback toast (Success / Error fallback)`

---

## 3. Normalized Map Data Schema (Redux Global State)

All collections use plain JavaScript Object Maps (`byId` + `allIds`) for $O(1)$ lookup, update, and deletion while remaining 100% JSON-serializable for `localStorage` and Express REST APIs.

### Slice 1: `boards` (`allBoards`)
```javascript
{
  byId: {
    "board-status": {
      id: "board-status",
      name: "StatusBoard",
      type: "status", // Locked system board (cannot be deleted or have lists added/removed)
      columns: [
        { id: "todo", title: "To Do" },
        { id: "in-progress", title: "In Progress" },
        { id: "done", title: "Completed" }
      ],
      createdAt: 1761800000000
    },
    "board-priority": {
      id: "board-priority",
      name: "Priority",
      type: "priority", // Locked system board
      columns: [
        { id: "low", title: "low" },
        { id: "mid", title: "mid" },
        { id: "high", title: "high" }
      ],
      createdAt: 1761800001000
    },
    "board-custom-1": {
      id: "board-custom-1",
      name: "Board 1",
      type: "custom", // User-created board (supports adding/editing/deleting lists)
      columns: [
        { id: "list1", title: "list1" },
        { id: "list2", title: "list2" },
        { id: "list3", title: "list3" }
      ],
      createdAt: 1761800002000
    }
  },
  allIds: ["board-status", "board-priority", "board-custom-1"],
  activeBoardId: "board-status" // Opens on StatusBoard by default
}

```

### Slice 2: `tasks` (`allTasks`)

```javascript
{
  byId: {
    "task-1": {
      id: "task-1",
      title: "Setup Redux Store & Write-Through Sync",
      description: "Ensure all writes persist to localStorage and Express backend",
      status: "in-progress",   // Maps to column ID in 'board-status'
      priority: "high",        // Maps to column ID in 'board-priority'
      customBoardPositions: {  // Map of { [customBoardId]: columnId }
        "board-custom-1": "list1"
      },
      dueDate: "2026-11-10",   // ISO Date string (YYYY-MM-DD)
      createdAt: 1761810000000,
      updatedAt: 1761810000000
    }
  },
  allIds: ["task-1"]
}

```

### Slice 3: `filters` (Ephemeral Frontend Query State — Never Persisted to DB)

```javascript
{
  searchQuery: "",             // Case-insensitive match against task.title
  sortBy: "createdAt-desc",    // 'dueDate-asc' | 'dueDate-desc' | 'priority-desc' | 'createdAt-desc'
  status: "all",               // 'all' | 'todo' | 'in-progress' | 'done'
  priority: "all",             // 'all' | 'low' | 'mid' | 'high'
  customBoards: {              // Map of { [customBoardId]: columnId | 'all' }
    "board-custom-1": "all"
  }
}

```

---

## 4. Core Business Logic & Interactive Rules

### Rule 1: The $N - 1$ Cross-Board Filtering Rule

* Suppose the user has $N$ total boards (`StatusBoard`, `Priority`, `Board 1`, `Board 2`, etc.) and is currently viewing **Board $X$** (`activeBoardId === X`).
* The Filter Popover in `TopNavComponent` dynamically displays filter dropdowns for the **remaining $N - 1$ boards**, completely excluding **Board $X$** (since Board $X$'s columns are already partitioning the screen).
* When switching `activeBoardId` to Board $Y$, the Redux `filtersSlice` automatically resets Board $Y$'s filter value to `'all'` via `extraReducers`.

### Rule 2: `RightBarComponent` (Remaining / Unassigned Tasks Pool)

* **Formula:** `RightBarTasks = allTasks - (Tasks assigned to a column in activeBoard)` (also filtered by active search/filters).
* **On `StatusBoard` and `Priority`:** Every task in `allTasks` is strictly required to have both a `status` and a `priority`. Therefore, on these two default boards, `RightBarComponent` renders an empty state reading: **"No Task Remaining"**.
* **On Custom Boards (`Board 1`, `Board 2`, etc.):** Any task that does not have `task.customBoardPositions[activeBoardId]` set appears inside `RightBarComponent`.
* Users can **drag a task from `RightBarComponent` and drop it into `list1`, `list2`, or `list3**` to assign it to that custom board.
* Users can **drag a task from `list1`, `list2`, or `list3` and drop it back into `RightBarComponent**` to unassign it from that custom board (keeping the task safely inside `allTasks`).



### Rule 3: Conditional Delete vs. Unassign Confirmation Popup (`ConfirmDeleteModal`)

* **If on `StatusBoard` or `Priority`:**
* Dragging a task to `RightBarComponent` OR clicking the Trash icon opens `ConfirmDeleteModal` asking: *"Status and Priority boards hold all tasks. Do you want to permanently delete this task from all boards?"* with **[Cancel]** and **[Delete Permanently]**.


* **If on a Custom Board (`Board 1`, `Board 2`, etc.):**
* Dragging a task to `RightBarComponent` immediately unassigns it from the custom board (`delete task.customBoardPositions[activeBoardId]`) and moves it to `RightBarComponent` with an info toast.
* Clicking the Trash icon on a card opens `ConfirmDeleteModal` offering **two clear actions**:
1. **[Remove from This Board Only]** (Moves task back to `RightBarComponent`)
2. **[Delete Task Permanently]** (Deletes task from `allTasks` across all boards)





### Rule 4: Dynamic List Management on Custom Boards

* When viewing a Custom Board (`activeBoard.type === 'custom'`), users can click **"+ Add List"** to append a new column (e.g., `list4`) using `activeBoardId` from Redux, or delete an existing custom list (which safely returns any tasks in that list back to `RightBarComponent`).
* On `StatusBoard` and `Priority`, list creation/deletion controls are hidden to protect system columns.

---

## 5. Complete DOM Component Tree & Hooks Matrix

```text
App (ToastContainer + WorkspaceLayout)
 └── WorkspaceLayout (Manages modal states + initial API/localStorage hydration)
      ├── LeftBarComponent (Sidebar Navigation)
      │    ├── BoardCardComponent [x N] (Selects active board; delete button for custom boards)
      │    └── MakeBoardButton ("make board" CTA at bottom of LeftBar)
      │
      └── MainWorkspaceArea
           ├── TopNavComponent (Search input, Sort dropdown, N-1 Filter popover, "create task" CTA)
           ├── BoardCanvasArea (Responsive horizontal layout)
           │    ├── ListComponent [x M] (HTML5 Drag-and-Drop column drop zone + header + "+ Add List" on custom boards)
           │    │    └── TaskCardComponent [x K] (Draggable task card, priority badge, due date, quick-move select, edit/delete)
           │    └── RightBarComponent (Unassigned task pool drop zone OR "No Task Remaining" state)
           │         └── TaskCardComponent [x U] (Draggable unassigned tasks)
           │
           └── Modals
                ├── TaskFormModal (Shared Create / Edit Task modal + Custom Board assignment selectors)
                ├── CreateBoardModal ("make board" modal: board name + dynamic list inputs)
                ├── AddListModal (Appends a new list/column to the active Custom Board)
                └── ConfirmDeleteModal (Handles permanent task deletion vs. custom board unassignment)

```

| Component | Redux Hooks | Local State (`useState`) | Other React Hooks |
| --- | --- | --- | --- |
| **`WorkspaceLayout`** | `useSelector`, `useDispatch` | `taskModalState` (`{isOpen, editingTask}`), `isCreateBoardOpen`, `isAddListOpen`, `deleteModalState` | `useEffect` (hydrate from API / `localStorage` on mount) |
| **`LeftBarComponent`** | `useSelector` (`allBoards`, `activeBoardId`) | `isMobileDrawerOpen` | — |
| **`BoardCardComponent`** | `useDispatch` (`setActiveBoard`, `deleteCustomBoard`) | `isHovered` | — |
| **`TopNavComponent`** | `useSelector` (`filters`, `filterableBoards`), `useDispatch` | `searchInput`, `isFilterOpen`, `isSortOpen` | `useEffect` (200ms search debounce), `useRef` (outside click close) |
| **`ListComponent`** | `useDispatch` (`moveTaskOnBoard`, `deleteBoardList`) | `isDragOver` | — |
| **`RightBarComponent`** | `useSelector` (`selectRightBarTasks`), `useDispatch` | `isDragOver` | — |
| **`TaskCardComponent`** | `useDispatch` (`moveTaskOnBoard`) | `isDragging` | — |
| **`TaskFormModal`** | `useSelector` (`allBoards`, `activeBoardId`), `useDispatch` | `formData` (`title`, `description`, `status`, `priority`, `dueDate`, `customBoardPositions`), `errors` | `useEffect` (populate form when editing) |
| **`CreateBoardModal`** | `useDispatch` (`createCustomBoard`) | `boardName`, `listTitles` (`['list1', 'list2', 'list3']`) | — |

---

## 6. Express Backend REST API Specification (`./server`)

Note: Search, Sort, and $N - 1$ Filtering are performed strictly in frontend Redux selectors. The backend handles persistent state hydration and write-through mutations.

| Method | Endpoint | Payload / Params | Description |
| --- | --- | --- | --- |
| `GET` | `/api/boards` | — | Returns normalized `allBoards` (`{ byId, allIds, activeBoardId }`) |
| `POST` | `/api/boards` | `{ id, name, type, columns, createdAt }` | Creates a new custom board |
| `PUT` | `/api/boards/:boardId` | `{ name, columns }` | Updates board details or adds/removes lists on a custom board |
| `DELETE` | `/api/boards/:boardId` | `boardId` param | Deletes a custom board and cleans up its key from all tasks |
| `GET` | `/api/tasks` | — | Returns normalized `allTasks` (`{ byId, allIds }`) |
| `POST` | `/api/tasks` | `Task` object | Creates a new task |
| `PUT` | `/api/tasks/:taskId` | Partial `Task` updates | Updates task details, column status/priority, or `customBoardPositions` |
| `DELETE` | `/api/tasks/:taskId` | `taskId` param | Permanently deletes a task from `allTasks` |

```

---



