import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Trash2, GripVertical, User } from 'lucide-react';

export interface KanbanTaskItem {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description?: string | null;
  position: number;
  dueDate?: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface KanbanCardProps {
  task: KanbanTaskItem;
  canMutate: boolean;
  onDelete?: (id: string) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ task, canMutate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    disabled: !canMutate,
    data: {
      type: 'Task',
      task
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-slate-800/90 hover:bg-slate-800 border rounded-lg p-3.5 mb-2.5 shadow-sm transition-all duration-150 ${
        isDragging
          ? 'border-cyan-500 shadow-xl shadow-cyan-500/20'
          : 'border-slate-700/70 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start space-x-2 flex-1">
          {canMutate && (
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded focus:outline-none"
              title="Drag card"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-100 leading-snug">
              {task.title}
            </h4>
            {task.description && (
              <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {canMutate && onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Metadata footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          {/* Fractional position tag (great for interviews to explain the math!) */}
          <span className="font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 text-[10px]">
            {Number(task.position.toFixed(2))}
          </span>

          {task.dueDate && (
            <span className="flex items-center space-x-1 text-slate-400">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </span>
          )}
        </div>

        {task.assignee && (
          <div
            className="flex items-center space-x-1 text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700"
            title={task.assignee.email}
          >
            <User className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[70px]">{task.assignee.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

