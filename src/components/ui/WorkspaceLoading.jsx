export function WorkspaceLoading() {
  return (
    <main className="curata-loading-screen" role="status" aria-live="polite" aria-label="Loading CurataMed">
      <div className="curata-loading-grid" aria-hidden="true" />
      <section className="curata-loading-content" aria-label="CurataMed loading status">
        <div className="curata-ekg-wrap" aria-hidden="true">
          <svg className="curata-ekg" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
            <path
              className="curata-ekg-path"
              d="M 10 60 L 120 60 Q 130 50 140 60 L 150 60 L 165 90 L 190 10 L 215 110 L 230 60 L 250 60 Q 265 40 280 60 L 390 60"
            />
          </svg>
        </div>

        <header className="curata-loading-brand">
          <h1>Curata<span>Med</span></h1>
          <p>Hospital Management System</p>
        </header>

        <div className="curata-loading-progress">
          <div className="curata-loading-label">Loading system modules...</div>
          <div className="curata-progress-track" role="progressbar" aria-label="Loading system modules" aria-valuetext="Loading in progress">
            <span className="curata-progress-fill" />
          </div>
        </div>
      </section>
    </main>
  );
}
