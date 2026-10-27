import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_WORKSPACE_MUTATION, GET_WORKSPACES_QUERY } from '../graphql/operations';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');

  const [createWorkspace, { loading }] = useMutation(CREATE_WORKSPACE_MUTATION, {
    refetchQueries: [{ query: GET_WORKSPACES_QUERY }]
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    const res = await createWorkspace({
      variables: { input: { name: name.trim() } }
    });

    setName('');
    onClose();

    if (res.data?.createWorkspace?.id) {
      onCreated(res.data.createWorkspace.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">Create Workspace</h3>
        <p className="text-xs text-slate-400 mb-4">
          A workspace groups your team members, boards, and project activities.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Infrastructure, Core Platform"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium rounded-lg shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

