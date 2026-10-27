import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Layers, Plus, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    members: Array<{ role: string; user: { id: string } }>;
  }>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onOpenCreateWorkspace: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
  onOpenCreateWorkspace
}) => {
  const { user, logout } = useAuth();

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const currentMembership = currentWorkspace?.members.find((m) => m.user.id === user?.id);
  const userRole = currentMembership?.role || 'MEMBER';

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-lg text-white shadow-md shadow-cyan-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                TaskSync
              </span>
              <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                v1.0
              </span>
            </div>
          </div>

          {/* Workspace Switcher */}
          {workspaces.length > 0 && (
            <div className="flex items-center space-x-2 pl-4 border-l border-slate-800">
              <select
                value={selectedWorkspaceId || ''}
                onChange={(e) => onSelectWorkspace(e.target.value)}
                className="bg-slate-800 text-slate-200 text-sm rounded-md px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onOpenCreateWorkspace}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
                title="Create Workspace"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* User Info, Role Badge & Logout */}
        <div className="flex items-center space-x-4">
          {/* Role badge */}
          {currentWorkspace && (
            <div className="hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border bg-slate-800/80 border-slate-700">
              <span className="text-slate-400">Role:</span>
              <span
                className={`font-semibold uppercase tracking-wider text-[11px] ${
                  userRole === 'OWNER'
                    ? 'text-amber-400'
                    : userRole === 'MEMBER'
                    ? 'text-cyan-400'
                    : 'text-emerald-400'
                }`}
              >
                {userRole}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm text-slate-300">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-semibold">
              {user?.name ? user.name[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left text-xs">
              <p className="font-medium text-slate-200">{user?.name}</p>
              <p className="text-slate-500 truncate max-w-[140px]">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700/60 transition"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

