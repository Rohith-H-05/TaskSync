export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          TaskSync
        </h1>
        <p className="mt-3 text-slate-400 text-sm">
          Real-Time Collaborative Kanban Board
        </p>
        <div className="mt-6 p-4 bg-slate-800/60 rounded-lg border border-slate-700/50 text-left">
          <p className="text-xs font-mono text-cyan-300">Phase 1 Initialized:</p>
          <ul className="mt-2 text-xs text-slate-300 list-disc list-inside space-y-1">
            <li>GraphQL API Service with JWT Auth</li>
            <li>PostgreSQL 16 & Redis 7 Docker Containers</li>
            <li>Liveness & Readiness Health Probes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
