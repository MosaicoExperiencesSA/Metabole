/** Schermata segnaposto per le sezioni non ancora sviluppate. */
export default function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card" style={{ textAlign: 'center', marginTop: 12 }}>
        <div
          style={{
            width: 76,
            height: 76,
            margin: '6px auto 14px',
            borderRadius: '50%',
            background: 'var(--cream)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden
        >
          <i className={`ti ${icon}`} style={{ fontSize: 34, color: 'var(--teal)' }} />
        </div>
        <h2 style={{ marginBottom: 4 }}>In arrivo</h2>
        <p className="muted" style={{ margin: 0 }}>
          Questa sezione è in costruzione. Torna presto!
        </p>
      </div>
    </>
  );
}
