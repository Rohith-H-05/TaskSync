import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_BOARD_ACTIVITY_QUERY } from '../graphql/operations';
import { X, Activity, Clock, User, Loader2 } from 'lucide-react';

interface ActivityFeedProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ boardId, isOpen, onClose }) => {
  const { data, loading, fetchMore, refetch } = useQuery(GET_BOARD_ACTIVITY_QUERY, {
    variables: { boardId, first: 15 },
    skip: !isOpen,
    fetchPolicy: 'cache-and-network'
  });

  if (!isOpen) return null;

  const activities = data?.boardActivity?.edges || [];
  const pageInfo = data?.boardActivity?.pageInfo;
  const totalCount = data?.boardActivity?.totalCount || 0;

  const handleLoadMore = () => {
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      fetchMore({
        variables: {
          after: pageInfo.endCursor
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            boardActivity: {
              ...fetchMoreResult.boardActivity,
              edges: [
                ...prev.boardActivity.edges,
                ...fetchMoreResult.boardActivity.edges
              ]
            }
          };
        }
      });
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
      case 'MOVED':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60';
      case 'DELETED':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700/60';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-sm text-slate-100">Board Activity Feed</h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {totalCount}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetch()}
            className="text-xs text-slate-400 hover:text-indigo-400 p-1"
            title="Refresh feed"
          >
            ↻
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mr-2" />
            <span>Loading activities...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No activity recorded on this board yet.
          </div>
        ) : (
          activities.map((edge: { cursor: string; node: any }) => {
            const log = edge.node;
            const details = log.details || {};

            return (
              <div
                key={log.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-xs space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${getActionBadge(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>

                <p className="text-slate-200 leading-relaxed font-medium">
                  {details.title ? (
                    <span>
                      &ldquo;{details.title}&rdquo;
                    </span>
                  ) : (
                    <span>Task modified</span>
                  )}
                </p>

                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-700/40">
                  <User className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-300 font-medium">{log.user?.name || 'Collaborator'}</span>
                </div>
              </div>
            );
          })
        )}

        {pageInfo?.hasNextPage && (
          <button
            onClick={handleLoadMore}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
          >
            Load older activity
          </button>
        )}
      </div>
    </div>
  );
};

