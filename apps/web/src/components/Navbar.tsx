import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Layers, Plus, User as UserIcon, Radio } from 'lucide-react';

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
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800/80 px-4 sm:px-6 py-2.5 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-sm shadow-indigo-600/30">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm tracking-tight text-white">
                TaskSync
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                PROD
              </span>
            </div>
          </div>

          {/* Workspace Switcher */}
          {workspaces.length > 0 && (
            <div className="flex items-center space-x-2 pl-3 sm:pl-4 border-l border-slate-800">
              <select
                value={selectedWorkspaceId || ''}
                onChange={(e) => onSelectWorkspace(e.target.value)}
                className="bg-slate-800/80 text-slate-200 text-xs rounded-md px-2.5 py-1.5 border border-slate-700/80 focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onOpenCreateWorkspace}
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700/80 transition cursor-pointer"
                title="Create Workspace"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Nav: WebSocket Indicator, Role Badge, User & Logout */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Live Sync Status Indicator */}
          <div className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-[11px] font-mono text-emerald-400">
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            <span>WebSocket Live</span>
          </div>

          {/* Role badge */}
          {currentWorkspace && (
            <div className="hidden sm:flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-md border bg-slate-800/60 border-slate-700/80 font-mono">
              <span className="text-slate-400 text-[10px]">ROLE:</span>
              <span
                className={`font-semibold text-[11px] ${
                  userRole === 'OWNER'
                    ? 'text-amber-400'
                    : userRole === 'MEMBER'
                    ? 'text-indigo-400'
                    : 'text-slate-400'
                }`}
              >
                {userRole}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold text-xs">
              {user?.name ? user.name[0].toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-medium text-slate-200 leading-none">{user?.name}</p>
              <p className="text-slate-400 text-[11px] truncate max-w-[130px] leading-tight mt-0.5">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-rose-400 bg-slate-800/40 hover:bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700/60 transition cursor-pointer"
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
