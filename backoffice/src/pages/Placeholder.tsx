export function Placeholder({ title, icon, note }: { title: string; icon: string; note?: string }) {
  return (
    <div className="card">
      <div className="empty">
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'var(--chip)',
            color: 'var(--chip-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 30 }} />
        </div>
        <h2 style={{ marginBottom: 6 }}>{title}</h2>
        <p style={{ maxWidth: 420, margin: '0 auto' }}>
          {note ?? 'Questa sezione fa parte del backoffice e verrà attivata a breve, con lo stesso stile e collegata alle API già pronte.'}
        </p>
      </div>
    </div>
  );
}
