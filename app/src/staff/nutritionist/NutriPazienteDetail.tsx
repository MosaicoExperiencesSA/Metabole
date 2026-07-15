import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { fullName, shortDate } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Avatar, BackBar, Card, Section, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';

interface Detail {
  user: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  profile: {
    name?: string | null;
    age?: number | null;
    sex?: string | null;
    allergies?: string[] | null;
    intolerances?: string[] | null;
    dislikedFoods?: string[] | null;
    regime?: string | null;
    dietStyle?: string | null;
    pathType?: string | null;
    screeningFlag?: boolean | null;
    onboardingAnswers?: { health?: { hasConditions?: boolean; takesMedications?: boolean } } | null;
  } | null;
  objective: { targetWeightKg?: number | null } | null;
  measurements: { id: string; date: string; weightKg: number }[];
  subscription: { plan?: { name?: string } | null } | null;
}
interface Doc {
  id: string;
  type: string;
  fileName: string;
  status: 'pending' | 'reviewed';
  flags: string[];
  uploadedAt: string;
}
interface Note {
  id: string;
  text: string;
  date: string;
  nutritionist?: { displayName?: string } | null;
}

const list = (arr?: string[] | null) => (arr && arr.length ? arr.join(', ') : '—');

export default function NutriPazienteDetail() {
  const { id } = useParams();
  const detail = useApi<Detail>(id ? `/admin/clients/${id}` : null);
  const docs = useApi<Doc[]>(id ? `/clients/${id}/documents` : null);
  const notes = useApi<Note[]>(id ? `/clients/${id}/notes` : null);
  const [noteText, setNoteText] = useState('');
  const [addNote, addState] = useAction(async (text: string) => {
    await api(`/clients/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
  });

  return (
    <StaffShell title="Cartella" tabs={NUTRI_TABS}>
      <BackBar label="Pazienti" to="/pazienti" />
      <Async state={detail}>
        {(d) => {
          const p = d.profile;
          const name = p?.name || fullName(d.user.firstName, d.user.lastName, d.user.email);
          const current = d.measurements[0]?.weightKg ?? null;
          return (
            <>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sf-row-name" style={{ fontSize: 16 }}>
                      {name}
                    </div>
                    <div className="sf-sub">
                      {[p?.age ? `${p.age} anni` : null, p?.sex].filter(Boolean).join(' · ') ||
                        d.subscription?.plan?.name ||
                        ''}
                    </div>
                  </div>
                  {p?.screeningFlag && (
                    <span className="sf-pill" style={{ background: '#EFEAF9', color: '#6C4CD6' }}>
                      Screening
                    </span>
                  )}
                </div>
              </Card>

              <div className="sf-sec">
                <span>Quadro clinico</span>
                <span className="sf-lock">
                  <i className="ti ti-lock" /> riservato
                </span>
              </div>
              <Card>
                <div className="sf-kv">
                  <span className="k">Condizioni dichiarate</span>
                  <span className="v">
                    {p?.onboardingAnswers?.health?.hasConditions ? 'Sì' : 'Nessuna'}
                  </span>
                </div>
                <div className="sf-kv">
                  <span className="k">Assume farmaci</span>
                  <span className="v">
                    {p?.onboardingAnswers?.health?.takesMedications ? 'Sì' : 'No'}
                  </span>
                </div>
                <div className="sf-kv">
                  <span className="k">Allergie</span>
                  <span className="v">{list(p?.allergies)}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Intolleranze</span>
                  <span className="v">{list(p?.intolerances)}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Cibi non graditi</span>
                  <span className="v">{list(p?.dislikedFoods)}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Peso attuale</span>
                  <span className="v">
                    {current != null ? `${current} kg` : '—'}
                    {d.objective?.targetWeightKg != null ? ` → ${d.objective.targetWeightKg} kg` : ''}
                  </span>
                </div>
              </Card>

              <Section title="Documenti" />
              <Async state={docs} empty={<Card><div className="sf-sub">Nessun documento.</div></Card>}>
                {(list2) =>
                  list2.length === 0 ? (
                    <Card>
                      <div className="sf-sub">Nessun documento caricato.</div>
                    </Card>
                  ) : (
                    <Card className="pad0">
                      {list2.map((doc) => {
                        const flagged = doc.flags && doc.flags.length > 0;
                        return (
                          <div key={doc.id} className="sf-row" style={{ cursor: 'default' }}>
                            <span
                              className="sf-alert-ic"
                              style={{
                                background: flagged ? '#FBE3E3' : '#E7EEF6',
                                color: flagged ? '#B4491F' : '#3A6EA5',
                              }}
                            >
                              <i className="ti ti-file-text" />
                            </span>
                            <div className="sf-row-main">
                              <div className="sf-row-name">{doc.fileName}</div>
                              <div className="sf-row-sub">
                                {shortDate(doc.uploadedAt)}
                                {flagged ? ' · valore fuori range' : ''}
                              </div>
                            </div>
                            <span
                              className="sf-pill"
                              style={
                                doc.status === 'reviewed'
                                  ? { background: '#DCF0D8', color: '#3B6D11' }
                                  : { background: '#FDF3DD', color: '#B8863B' }
                              }
                            >
                              {doc.status === 'reviewed' ? 'Rivisto' : 'Da rivedere'}
                            </span>
                          </div>
                        );
                      })}
                    </Card>
                  )
                }
              </Async>

              <Section title="Note cliniche" />
              <Async state={notes}>
                {(ns) => (
                  <>
                    {ns.length > 0 && (
                      <Card className="pad0">
                        {ns.map((n) => (
                          <div key={n.id} className="sf-row" style={{ cursor: 'default', display: 'block' }}>
                            <div style={{ fontSize: 13.5 }}>{n.text}</div>
                            <div className="sf-row-sub" style={{ marginTop: 4 }}>
                              {n.nutritionist?.displayName || 'Nutrizionista'} · {shortDate(n.date)}
                            </div>
                          </div>
                        ))}
                      </Card>
                    )}
                    <Card>
                      <textarea
                        className="sf-inp"
                        placeholder="Aggiungi una nota clinica…"
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        style={{ resize: 'vertical', marginBottom: 8 }}
                      />
                      <button
                        className="sf-btn p"
                        disabled={!noteText.trim() || addState.loading}
                        onClick={async () => {
                          const ok = await addNote(noteText.trim());
                          if (ok) {
                            setNoteText('');
                            notes.reload();
                          }
                        }}
                      >
                        <i className="ti ti-notes" /> Salva nota
                      </button>
                    </Card>
                  </>
                )}
              </Async>
            </>
          );
        }}
      </Async>
    </StaffShell>
  );
}
