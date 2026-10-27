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
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
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
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span>Loading workspace data...</span>
          </div>
        ) : workspaces.length === 0 ? (
          /* Empty State: Create First Workspace */
          <div className="max-w-md mx-auto text-center py-20 px-4">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to TaskSync</h2>
            <p className="text-sm text-slate-400 mb-6">
              To get started, create your first team workspace where you can collaborate on boards in real time.
            </p>
            <button
              onClick={() => setIsWorkspaceModalOpen(true)}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-cyan-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        ) : selectedBoardId && boardData?.board ? (
          /* Kanban Board View */
          <div className="flex flex-col h-full">
            <div className="bg-slate-900/40 border-b border-slate-800/80 px-6 py-2 flex items-center space-x-3 text-xs text-slate-400">
              <button
                onClick={() => setSelectedBoardId(null)}
                className="flex items-center space-x-1 hover:text-cyan-400 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>
              <span>/</span>
              <span className="text-slate-200 font-medium">{currentWorkspace?.name}</span>
              <span>/</span>
              <span className="text-cyan-400 font-medium">{boardData.board.title}</span>
            </div>

            <KanbanBoard board={boardData.board} canMutate={canMutate} />
          </div>
        ) : selectedBoardId && boardLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span>Loading board columns and tasks...</span>
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
