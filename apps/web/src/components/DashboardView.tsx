import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_BOARD_MUTATION, GET_WORKSPACES_QUERY } from '../graphql/operations';
import { KanbanSquare, Plus, Users, ArrowRight, Layers } from 'lucide-react';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 font-sans">
      {/* Workspace Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">{workspace.name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              /{workspace.slug}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time collaborative sprint boards and active team members
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {canMutate && (
            <button
              onClick={() => setIsCreatingBoard(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Board</span>
            </button>
          )}
        </div>
      </div>

      {/* Boards Grid */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2 font-mono">
            <KanbanSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active Boards ({workspace.boards.length})</span>
          </h2>
        </div>

        {workspace.boards.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800/80 rounded-xl p-8">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No boards in this workspace</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Create a board to track sprint items with fractional positioning and live subscriptions.
            </p>
            {canMutate && (
              <button
                onClick={() => setIsCreatingBoard(true)}
                className="mt-4 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition cursor-pointer"
              >
                Create First Board
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspace.boards.map((b) => (
              <div
                key={b.id}
                onClick={() => onSelectBoard(b.id)}
                className="group cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition">
                    {b.title}
                  </h3>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">
                  {b.description || 'Continuous integration and collaborative task workflow.'}
                </p>
                <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Sync Active</span>
                  </span>
                  <span className="text-indigo-400 group-hover:underline font-medium">Open board →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Members Section */}
      <div className="mt-12 pt-8 border-t border-slate-800/80">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-2 font-mono">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>Team Collaborators ({workspace.members.length})</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {workspace.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center space-x-3 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 text-xs"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-xs">
                {m.user.name ? m.user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 truncate">
                <p className="font-medium text-slate-200 truncate leading-tight">{m.user.name}</p>
                <p className="text-slate-500 text-[11px] truncate mt-0.5">{m.user.email}</p>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  m.role === 'OWNER'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    : m.role === 'MEMBER'
                    ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700/60'
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Create Collaborative Board</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a board to track sprint items with automated real-time subscriptions.
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
                  placeholder="e.g. Sprint 24 / Platform Core"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                  placeholder="Goals and sprint deliverables..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingBoard(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!boardTitle.trim() || loading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
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
