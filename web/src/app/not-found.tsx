import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap main">
      <div className="card empty">
        <h2>This page is not here</h2>
        <p className="muted">The home may have been rented or taken down.</p>
        <p style={{ marginTop: 24 }}>
          <Link className="button button--primary" href="/homes">
            See homes to rent
          </Link>
        </p>
      </div>
    </main>
  );
}
