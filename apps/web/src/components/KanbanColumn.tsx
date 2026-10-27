import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard, KanbanTaskItem } from './KanbanCard';
import { Plus, X, MoreHorizontal } from 'lucide-react';

export interface KanbanColumnItem {
  id: string;
  boardId: string;
  title: string;
  position: number;
  tasks: KanbanTaskItem[];
}

interface KanbanColumnProps {
  column: KanbanColumnItem;
  canMutate: boolean;
  onAddTask: (columnId: string, title: string, description?: string) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  canMutate,
  onAddTask,
  onDeleteTask
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column
    }
  });

  const taskIds = column.tasks.map((t) => t.id);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddTask(column.id, title.trim(), description.trim() || undefined);
      setTitle('');
      setDescription('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derive column status dot color
  const titleLower = column.title.toLowerCase();
  const statusColor = titleLower.includes('done') || titleLower.includes('complete')
    ? 'bg-emerald-400'
    : titleLower.includes('progress') || titleLower.includes('doing')
    ? 'bg-amber-400'
    : titleLower.includes('backlog')
    ? 'bg-slate-400'
    : 'bg-indigo-400';

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 flex flex-col bg-slate-900/70 border rounded-xl max-h-[calc(100vh-120px)] shadow-sm transition-colors duration-150 ${
        isOver ? 'border-indigo-500/80 bg-slate-800/40 ring-1 ring-indigo-500/50' : 'border-slate-800/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">{column.title}</h3>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono font-medium border border-slate-700/60">
            {column.tasks.length}
          </span>
        </div>

        <button
          className="text-slate-600 hover:text-slate-400 p-0.5 rounded transition"
          title="Column options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Task Cards List */}
      <div className="p-2.5 overflow-y-auto flex-1 custom-scrollbar min-h-[80px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              canMutate={canMutate}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && !isAdding && (
          <div className="text-center py-6 border border-dashed border-slate-800/70 rounded-lg text-slate-600 text-xs">
            No cards
          </div>
        )}
      </div>

      {/* Footer / Add Card */}
      {canMutate && (
        <div className="p-2 border-t border-slate-800/70">
          {isAdding ? (
            <form onSubmit={handleCreateTask} className="space-y-2 p-1">
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-slate-800/90 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none transition"
              />
              <div className="flex items-center space-x-1.5 pt-0.5">
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Adding...' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-1.5 px-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 flex items-center justify-center space-x-1.5 text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a card</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
