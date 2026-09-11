import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main aria-label="Not found" className="bl-wrap" style={{ flex: 1, maxWidth: 560, padding: '90px 32px 20px', textAlign: 'center' }}>
      <div className="bl-display" style={{ fontSize: 64, color: 'var(--bl-lime-wash)', lineHeight: 1 }}>
        404
      </div>
      <h1 className="bl-display" style={{ fontSize: 30, margin: '10px 0 0' }}>
        That page isn’t here
      </h1>
      <p className="bl-muted" style={{ fontSize: 15, margin: '10px 0 0' }}>
        The link may be old, or mistyped.
      </p>
      <Link to="/" className="bl-btn primary" style={{ marginTop: 22 }}>
        Back to the shop
      </Link>
    </main>
  );
}
