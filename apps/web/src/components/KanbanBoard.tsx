import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useSubscription } from '@apollo/client';
import { KanbanColumn, KanbanColumnItem } from './KanbanColumn';
import { KanbanCard, KanbanTaskItem } from './KanbanCard';
import { ActivityFeed } from './ActivityFeed';
import { calculateFractionalPosition } from '../lib/fractional';
import {
  MOVE_TASK_MUTATION,
  CREATE_TASK_MUTATION,
  DELETE_TASK_MUTATION,
  CREATE_COLUMN_MUTATION,
  GET_BOARD_QUERY,
  BOARD_UPDATED_SUBSCRIPTION
} from '../graphql/operations';
import { Search, Plus, Activity } from 'lucide-react';

interface KanbanBoardProps {
  board: {
    id: string;
    workspaceId: string;
    title: string;
    description?: string | null;
    columns: KanbanColumnItem[];
  };
  canMutate: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ board, canMutate }) => {
  const [columns, setColumns] = useState<KanbanColumnItem[]>(board.columns);
  const [activeTask, setActiveTask] = useState<KanbanTaskItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);

  // Sync columns if board prop updates
  React.useEffect(() => {
    setColumns(board.columns);
  }, [board.columns]);

  // Real-Time GraphQL Subscription for multi-user synchronization
  useSubscription(BOARD_UPDATED_SUBSCRIPTION, {
    variables: { boardId: board.id },
    onData: ({ data }) => {
      const event = data.data?.boardUpdated;
      if (!event) return;

      setColumns((prevCols) => {
        // Handle incoming real-time events
        if (event.type === 'TASK_CREATED' && event.task) {
          const newTask = event.task as KanbanTaskItem;
          return prevCols.map((col) => {
            if (col.id === newTask.columnId) {
              if (col.tasks.some((t) => t.id === newTask.id)) return col;
              return {
                ...col,
                tasks: [...col.tasks, newTask].sort((a, b) => a.position - b.position)
              };
            }
            return col;
          });
        }

        if (event.type === 'TASK_MOVED' && event.task) {
          const movedTask = event.task as KanbanTaskItem;
          // Remove from previous column and insert into new column
          return prevCols.map((col) => {
            if (col.id === movedTask.columnId) {
              const existingIndex = col.tasks.findIndex((t) => t.id === movedTask.id);
              let updatedTasks;
              if (existingIndex >= 0) {
                updatedTasks = col.tasks.map((t) => (t.id === movedTask.id ? movedTask : t));
              } else {
                updatedTasks = [...col.tasks, movedTask];
              }
              return {
                ...col,
                tasks: updatedTasks.sort((a, b) => a.position - b.position)
              };
            } else {
              // Strip from other columns if it was moved across
              return {
                ...col,
                tasks: col.tasks.filter((t) => t.id !== movedTask.id)
              };
            }
          });
        }

        if (event.type === 'TASK_DELETED' && event.taskId) {
          return prevCols.map((col) => ({
            ...col,
            tasks: col.tasks.filter((t) => t.id !== event.taskId)
          }));
        }

        if (event.type === 'COLUMN_CREATED' && event.column) {
          const newCol = event.column as KanbanColumnItem;
          if (prevCols.some((c) => c.id === newCol.id)) return prevCols;
          return [...prevCols, { ...newCol, tasks: [] }].sort((a, b) => a.position - b.position);
        }

        return prevCols;
      });
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // prevents accidental drags on click
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // GraphQL Mutations
  const [moveTaskMutation] = useMutation(MOVE_TASK_MUTATION);
  const [createTaskMutation] = useMutation(CREATE_TASK_MUTATION, {
    refetchQueries: [{ query: GET_BOARD_QUERY, variables: { id: board.id } }]
  });
  const [deleteTaskMutation] = useMutation(DELETE_TASK_MUTATION, {
    refetchQueries: [{ query: GET_BOARD_QUERY, variables: { id: board.id } }]
  });
  const [createColumnMutation] = useMutation(CREATE_COLUMN_MUTATION, {
    refetchQueries: [{ query: GET_BOARD_QUERY, variables: { id: board.id } }]
  });

  // Client-side task filter
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns;
    const query = searchQuery.toLowerCase();

    return columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query))
      )
    }));
  }, [columns, searchQuery]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as KanbanTaskItem | undefined;
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    // Find source and target columns
    const sourceCol = columns.find((c) => c.tasks.some((t) => t.id === activeId));
    let targetCol = columns.find((c) => c.tasks.some((t) => t.id === overId));

    if (!targetCol) {
      // Over might be the column container itself
      targetCol = columns.find((c) => c.id === overId);
    }

    if (!sourceCol || !targetCol) return;

    // Moving between columns during drag
    if (sourceCol.id !== targetCol.id) {
      setColumns((prevCols) => {
        const sourceTasks = [...sourceCol.tasks];
        const targetTasks = [...targetCol.tasks];

        const activeIndex = sourceTasks.findIndex((t) => t.id === activeId);
        const movingTask = { ...sourceTasks[activeIndex], columnId: targetCol.id };

        sourceTasks.splice(activeIndex, 1);

        const overIndex = targetTasks.findIndex((t) => t.id === overId);
        if (overIndex >= 0) {
          targetTasks.splice(overIndex, 0, movingTask);
        } else {
          targetTasks.push(movingTask);
        }

        return prevCols.map((c) => {
          if (c.id === sourceCol.id) return { ...c, tasks: sourceTasks };
          if (c.id === targetCol.id) return { ...c, tasks: targetTasks };
          return c;
        });
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Identify target column
    let targetCol = columns.find((c) => c.tasks.some((t) => t.id === overId));
    if (!targetCol) {
      targetCol = columns.find((c) => c.id === overId);
    }
    if (!targetCol) return;

    const currentTaskIndex = targetCol.tasks.findIndex((t) => t.id === activeId);
    if (currentTaskIndex < 0) return;

    // Calculate new fractional position
    const newPosition = calculateFractionalPosition(
      targetCol.tasks,
      currentTaskIndex,
      activeId
    );

    // Update local state immediately (Optimistic feedback)
    setColumns((prevCols) =>
      prevCols.map((col) => {
        if (col.id === targetCol.id) {
          return {
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === activeId ? { ...t, position: newPosition, columnId: targetCol.id } : t
            )
          };
        }
        return col;
      })
    );

    // Perform GraphQL mutation with optimisticResponse
    try {
      await moveTaskMutation({
        variables: {
          input: {
            id: activeId,
            targetColumnId: targetCol.id,
            newPosition
          }
        },
        optimisticResponse: {
          moveTask: {
            __typename: 'Task',
            id: activeId,
            columnId: targetCol.id,
            position: newPosition
          }
        }
      });
    } catch (err) {
      console.error('Failed to move task:', err);
      // Rollback to server state if error
      setColumns(board.columns);
    }
  };

  const handleAddTask = async (columnId: string, title: string, description?: string) => {
    const col = columns.find((c) => c.id === columnId);
    const lastTask = col?.tasks[col.tasks.length - 1];
    const position = lastTask ? lastTask.position + 1000.0 : 1000.0;

    await createTaskMutation({
      variables: {
        input: {
          boardId: board.id,
          columnId,
          title,
          description: description || null,
          position
        }
      }
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTaskMutation({
      variables: { id: taskId }
    });
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;

    const lastCol = columns[columns.length - 1];
    const position = lastCol ? lastCol.position + 1000.0 : 1000.0;

    await createColumnMutation({
      variables: {
        input: {
          boardId: board.id,
          title: newColumnTitle.trim(),
          position
        }
      }
    });

    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      {/* Board Sub-header: Title, Task Search & Add Column */}
      <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>{board.title}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-normal">
                Live Board
              </span>
            </h2>
            {board.description && (
              <p className="text-xs text-slate-400 mt-0.5">{board.description}</p>
            )}
          </div>
        </div>

        {/* Search bar & Controls */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={() => setIsActivityFeedOpen((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              isActivityFeedOpen
                ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Toggle Activity Feed"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>

          {canMutate && (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Column</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Drag & Drop Kanban Canvas */}
      <div className="flex-1 overflow-x-auto p-6 bg-slate-950/80 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start space-x-4 min-w-max pb-4">
            {filteredColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                canMutate={canMutate}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
              />
            ))}

            {/* Add Column Button / Form */}
            {canMutate && (
              <div className="w-72 flex-shrink-0">
                {isAddingColumn ? (
                  <form
                    onSubmit={handleAddColumn}
                    className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-lg"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Column name (e.g. Review)..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <div className="flex items-center space-x-2 mt-2.5">
                      <button
                        type="submit"
                        disabled={!newColumnTitle.trim()}
                        className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingColumn(false)}
                        className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-900/40 rounded-xl text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-2 text-xs font-medium transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Column</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Drag Overlay Preview */}
          <DragOverlay>
            {activeTask ? (
              <div className="w-80 rotate-2 scale-105 shadow-2xl">
                <KanbanCard task={activeTask} canMutate={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Activity Feed Slide-over Drawer */}
      <ActivityFeed
        boardId={board.id}
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
      />
    </div>
  );
};
