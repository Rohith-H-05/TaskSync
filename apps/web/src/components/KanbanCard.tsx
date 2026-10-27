import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical, Clock } from 'lucide-react';

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
    opacity: isDragging ? 0.35 : 1
  };

  // Derive priority based on task keywords or position for clean visual variety
  const isUrgent = /urgent|critical|blocker|hotfix/i.test(task.title);
  const isHigh = /feat|api|graphql|auth|security/i.test(task.title);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-slate-900 hover:bg-slate-800/90 border rounded-xl p-3 mb-2 shadow-sm transition-all duration-150 select-none ${
        isDragging
          ? 'border-indigo-500 shadow-xl shadow-indigo-500/20 ring-1 ring-indigo-500'
          : 'border-slate-800/90 hover:border-slate-700/80 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-start space-x-1.5 flex-1 min-w-0">
          {canMutate && (
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded transition"
              title="Drag card"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            {/* Priority and Tag Badge */}
            <div className="flex items-center space-x-1.5 mb-1">
              <span
                className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded font-mono ${
                  isUrgent
                    ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                    : isHigh
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                    : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                }`}
              >
                {isUrgent ? 'Urgent' : isHigh ? 'High' : 'Task'}
              </span>
            </div>

            <h4 className="text-xs font-medium text-slate-100 leading-snug break-words">
              {task.title}
            </h4>

            {task.description && (
              <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {canMutate && onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition-opacity cursor-pointer flex-shrink-0"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Metadata footer */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center space-x-1.5">
          {/* Fractional position badge (great for interview demonstrations) */}
          <span
            className="font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-indigo-400 text-[10px]"
            title="IEEE-754 Fractional Position Index"
          >
            #{Number(task.position.toFixed(1))}
          </span>

          {task.dueDate && (
            <span className="flex items-center space-x-1 text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </span>
          )}
        </div>

        {task.assignee ? (
          <div
            className="flex items-center space-x-1 text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded-full border border-slate-800"
            title={task.assignee.email}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-indigo-600/30 text-indigo-300 text-[9px] flex items-center justify-center font-bold">
              {task.assignee.name[0].toUpperCase()}
            </div>
            <span className="truncate max-w-[60px] text-[10px]">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 font-mono">Unassigned</span>
        )}
      </div>
    </div>
  );
};
