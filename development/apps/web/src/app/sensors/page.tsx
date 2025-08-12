import Link from 'next/link';

export default function SensorsPage() {
  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-links">
            <Link href="/" className="nav-link">← Home</Link>
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
            <Link href="/mvp" className="nav-link">MVP Demo</Link>
            <Link href="/sensors" className="nav-link active">Sensors</Link>
          </div>
          <div className="text-small">Sensor Management</div>
        </div>
      </nav>

      <div className="section">
        <div className="container">
          <h1 className="h1 mb-6">Sensors Dashboard</h1>
          <div className="card">
            <div className="card-body text-center py-12">
              <div className="text-muted mb-4">🔧</div>
              <h2 className="h3 mb-2">Sensors Dashboard</h2>
              <p className="text-muted">Advanced sensor management functionality coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
