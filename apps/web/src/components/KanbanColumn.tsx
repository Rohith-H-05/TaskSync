import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard, KanbanTaskItem } from './KanbanCard';
import { Plus, X } from 'lucide-react';

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

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 flex flex-col bg-slate-900/90 border rounded-xl max-h-[calc(100vh-140px)] shadow-lg transition-colors duration-150 ${
        isOver ? 'border-cyan-500/80 bg-slate-800/50' : 'border-slate-800'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-sm text-slate-200">{column.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-medium">
            {column.tasks.length}
          </span>
        </div>
      </div>

      {/* Task Cards List */}
      <div className="p-3 overflow-y-auto flex-1 custom-scrollbar min-h-[100px]">
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
          <div className="text-center py-8 border-2 border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
            Drop cards here
          </div>
        )}
      </div>

      {/* Footer / Add Card */}
      {canMutate && (
        <div className="p-2.5 border-t border-slate-800/70">
          {isAdding ? (
            <form onSubmit={handleCreateTask} className="space-y-2">
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details or acceptance criteria..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              />
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 flex items-center justify-center space-x-1.5 text-xs transition border border-transparent hover:border-slate-700/60"
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

