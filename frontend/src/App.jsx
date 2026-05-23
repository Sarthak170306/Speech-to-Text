function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/30">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80">Speech to Text</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                Transcription Dashboard
              </h1>
            </div>
            <div className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-700">
              Ready for audio uploads
            </div>
          </div>
          <div className="space-y-4 rounded-2xl bg-slate-950/80 p-6 ring-1 ring-slate-700">
            <p className="text-slate-400">
              Upload audio, save transcriptions, and build intelligent speech workflows. Your backend and database are ready to connect.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-700">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
                <p className="mt-3 text-xl font-semibold text-white">Connected</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-700">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Uploads</p>
                <p className="mt-3 text-xl font-semibold text-white">0 pending</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-700">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Next step</p>
                <p className="mt-3 text-xl font-semibold text-white">Add audio input</p>
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
