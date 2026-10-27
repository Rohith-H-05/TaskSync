import { useState, useEffect } from 'react';
import { ApolloProvider, useQuery } from '@apollo/client';
import { apolloClient } from './lib/apollo';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/AuthView';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { DashboardView } from './components/DashboardView';
import { CreateWorkspaceModal } from './components/CreateWorkspaceModal';
import { GET_WORKSPACES_QUERY, GET_BOARD_QUERY } from './graphql/operations';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';

function MainApp() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const { data: wsData, loading: wsLoading } = useQuery(GET_WORKSPACES_QUERY, {
    skip: !token
  });

  const { data: boardData, loading: boardLoading } = useQuery(GET_BOARD_QUERY, {
    variables: { id: selectedBoardId },
    skip: !selectedBoardId
  });

  const workspaces = wsData?.workspaces || [];

  // Default select first workspace when loaded
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!user || !token) {
    return <AuthView />;
  }

  const currentWorkspace = workspaces.find((w: { id: string }) => w.id === selectedWorkspaceId);
  const currentMembership = currentWorkspace?.members?.find(
    (m: { user: { id: string } }) => m.user.id === user.id
  );
  const userRole = currentMembership?.role || 'MEMBER';
  const canMutate = userRole === 'OWNER' || userRole === 'MEMBER';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectWorkspace={(id) => {
          setSelectedWorkspaceId(id);
          setSelectedBoardId(null);
        }}
        onOpenCreateWorkspace={() => setIsWorkspaceModalOpen(true)}
      />

      <main className="flex-1 overflow-hidden">
        {wsLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mr-2" />
            <span className="text-xs">Loading workspace data...</span>
          </div>
        ) : workspaces.length === 0 ? (
          /* Empty State: Create First Workspace */
          <div className="max-w-md mx-auto text-center py-20 px-4">
            <h2 className="text-lg font-bold text-white mb-2">Welcome to TaskSync</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Create your first team workspace to start collaborating on boards with real-time subscriptions and fractional positioning.
            </p>
            <button
              onClick={() => setIsWorkspaceModalOpen(true)}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        ) : selectedBoardId && boardData?.board ? (
          /* Kanban Board View */
          <div className="flex flex-col h-full">
            <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-2 flex items-center space-x-2 text-xs text-slate-400">
              <button
                onClick={() => setSelectedBoardId(null)}
                className="flex items-center space-x-1 hover:text-indigo-300 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300 font-medium">{currentWorkspace?.name}</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-medium">{boardData.board.title}</span>
            </div>

            <KanbanBoard board={boardData.board} canMutate={canMutate} />
          </div>
        ) : selectedBoardId && boardLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mr-2" />
            <span className="text-xs">Loading board columns and tasks...</span>
          </div>
        ) : currentWorkspace ? (
          /* Workspace Dashboard View */
          <DashboardView
            workspace={currentWorkspace}
            canMutate={canMutate}
            onSelectBoard={(boardId) => setSelectedBoardId(boardId)}
          />
        ) : null}
      </main>

      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onCreated={(id) => {
          setSelectedWorkspaceId(id);
          setSelectedBoardId(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ApolloProvider>
  );
}
