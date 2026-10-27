import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_BOARD_MUTATION, GET_WORKSPACES_QUERY } from '../graphql/operations';
import { KanbanSquare, Plus, Users, Calendar, ArrowRight } from 'lucide-react';

interface DashboardViewProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    members: Array<{
      id: string;
      role: string;
      user: { id: string; name: string; email: string };
    }>;
    boards: Array<{
      id: string;
      title: string;
      description?: string | null;
    }>;
  };
  canMutate: boolean;
  onSelectBoard: (boardId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  workspace,
  canMutate,
  onSelectBoard
}) => {
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
  const [boardDesc, setBoardDesc] = useState('');

  const [createBoardMutation, { loading }] = useMutation(CREATE_BOARD_MUTATION, {
    refetchQueries: [{ query: GET_WORKSPACES_QUERY }]
  });

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardTitle.trim() || loading) return;

    const res = await createBoardMutation({
      variables: {
        input: {
          workspaceId: workspace.id,
          title: boardTitle.trim(),
          description: boardDesc.trim() || null
        }
      }
    });

    setBoardTitle('');
    setBoardDesc('');
    setIsCreatingBoard(false);

    if (res.data?.createBoard?.id) {
      onSelectBoard(res.data.createBoard.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Workspace Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-100">{workspace.name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              /{workspace.slug}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Collaborative boards and workflows for this workspace
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {canMutate && (
            <button
              onClick={() => setIsCreatingBoard(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-cyan-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Board</span>
            </button>
          )}
        </div>
      </div>

      {/* Boards Grid */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-2">
          <KanbanSquare className="w-4 h-4 text-cyan-400" />
          <span>Boards ({workspace.boards.length})</span>
        </h2>

        {workspace.boards.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <KanbanSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No boards yet</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              Create your first board to start tracking sprints, features, and tasks with real-time sync.
            </p>
            {canMutate && (
              <button
                onClick={() => setIsCreatingBoard(true)}
                className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition"
              >
                Create Board
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspace.boards.map((b) => (
              <div
                key={b.id}
                onClick={() => onSelectBoard(b.id)}
                className="group cursor-pointer bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-base text-slate-100 group-hover:text-cyan-400 transition">
                    {b.title}
                  </h3>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
                </div>
                <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
                  {b.description || 'No description provided.'}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Real-time Kanban</span>
                  </span>
                  <span className="text-cyan-400 text-[11px] font-medium">Open board →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Members Section */}
      <div className="mt-12 pt-8 border-t border-slate-800/80">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Team Members ({workspace.members.length})</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {workspace.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center space-x-3 bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                {m.user.name[0].toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <p className="font-medium text-slate-200 truncate">{m.user.name}</p>
                <p className="text-slate-500 truncate">{m.user.email}</p>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  m.role === 'OWNER'
                    ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                    : m.role === 'MEMBER'
                    ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
                    : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                }`}
              >
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Board Modal */}
      {isCreatingBoard && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create New Board</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a board with automated Kanban columns (To Do, In Progress, Done).
            </p>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Board Title
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={boardTitle}
                  onChange={(e) => setBoardTitle(e.target.value)}
                  placeholder="e.g. Sprint 24 / Q4 Platform"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={boardDesc}
                  onChange={(e) => setBoardDesc(e.target.value)}
                  placeholder="Brief description of board objectives..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingBoard(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!boardTitle.trim() || loading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
