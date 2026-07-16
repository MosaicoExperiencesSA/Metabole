import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { euro, shortDate } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Card, Section, StaffShell, type TabItem } from '../ui';

interface Withdrawal {
  id: string;
  amountCents: number;
  iban: string;
  status: 'requested' | 'paid' | 'rejected';
  requestedAt: string;
  paidAt: string | null;
  note?: string | null;
  hasReceipt: boolean;
}
interface Wallet {
  isStaff: boolean;
  inMaturazioneCents: number;
  prelevabileCents: number;
  prelevatoCents: number;
  pendingRequestedCents: number;
  availableToRequestCents: number;
  iban: string | null;
  windowOpen: boolean;
  canRequest: boolean;
  pendingRequest: Withdrawal | null;
  recent: Withdrawal[];
}

const STATUS: Record<Withdrawal['status'], [string, string, string]> = {
  requested: ['#FDF3DD', '#B8863B', 'In lavorazione'],
  paid: ['#DCF0D8', '#3B6D11', 'Pagato'],
  rejected: ['#FBE3E3', '#B4491F', 'Rifiutato'],
};

export default function Guadagni({ tabs }: { tabs: TabItem[] }) {
  const { user } = useAuth();
  const roleSub = user?.role && ['nutritionist', 'head_nutritionist'].includes(user.role) ? 'Nutrizionista' : 'Coach';
  const wallet = useApi<Wallet>('/me/wallet');
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState('');
  const [request, reqState] = useAction(async (cents: number, ibanValue: string) => {
    await api('/me/wallet/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amountCents: cents, iban: ibanValue }),
    });
  });

  return (
    <StaffShell title="Guadagni" subtitle={roleSub} tabs={tabs}>
      <Async state={wallet}>
        {(w) => {
          const ibanValue = iban || w.iban || '';
          const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
          const validAmount = Number.isFinite(cents) && cents > 0 && cents <= w.availableToRequestCents;
          const validIban = ibanValue.replace(/\s/g, '').length >= 15;

          return (
            <>
              <div className="sf-earn-row">
                <div className="sf-earn g1">
                  <div className="lab">Prelevabile ora</div>
                  <div className="val">{euro(w.prelevabileCents)}</div>
                </div>
                <div className="sf-earn g2">
                  <div className="lab">In maturazione</div>
                  <div className="val">{euro(w.inMaturazioneCents)}</div>
                </div>
              </div>

              <Card>
                <div className="sf-kv">
                  <span className="k">Già prelevato</span>
                  <span className="v">{euro(w.prelevatoCents)}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Richieste in attesa</span>
                  <span className="v">{euro(w.pendingRequestedCents)}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Disponibile a richiesta</span>
                  <span className="v">{euro(w.availableToRequestCents)}</span>
                </div>
              </Card>

              {w.pendingRequest ? (
                <Card>
                  <Section title="Richiesta in corso" />
                  <div className="sf-kv">
                    <span className="k">{euro(w.pendingRequest.amountCents)}</span>
                    <span className="v" style={{ color: STATUS[w.pendingRequest.status][1] }}>
                      {STATUS[w.pendingRequest.status][2]}
                    </span>
                  </div>
                  <div className="sf-sub" style={{ marginTop: 4 }}>
                    Richiesto il {shortDate(w.pendingRequest.requestedAt)} · IBAN{' '}
                    {w.pendingRequest.iban}
                  </div>
                </Card>
              ) : (
                <Card>
                  <Section title="Richiedi un prelievo" />
                  {!w.windowOpen && (
                    <div className="sf-sub" style={{ marginBottom: 8, color: '#B4491F' }}>
                      La finestra prelievi è aperta dal 1° al 7 del mese.
                    </div>
                  )}
                  <input
                    className="sf-inp"
                    inputMode="decimal"
                    placeholder="Importo in € (es. 250)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  <input
                    className="sf-inp"
                    placeholder="IBAN per l'accredito"
                    value={ibanValue}
                    onChange={(e) => setIban(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  {reqState.error && (
                    <div className="sf-sub" style={{ color: '#B4491F', marginBottom: 8 }}>
                      {reqState.error}
                    </div>
                  )}
                  <button
                    className="sf-btn p"
                    disabled={!w.canRequest || !validAmount || !validIban || reqState.loading}
                    onClick={async () => {
                      const ok = await request(cents, ibanValue);
                      if (ok) {
                        setAmount('');
                        wallet.reload();
                      }
                    }}
                  >
                    <i className="ti ti-cash" /> Richiedi prelievo
                  </button>
                  <div className="sf-sub" style={{ textAlign: 'center', marginTop: 8 }}>
                    Accredito sul tuo IBAN entro 3 giorni lavorativi.
                  </div>
                </Card>
              )}

              <Section title="Storico prelievi" />
              <Card className="pad0">
                {w.recent.length === 0 ? (
                  <div className="sf-empty" style={{ padding: 22 }}>
                    <p>Ancora nessun prelievo.</p>
                  </div>
                ) : (
                  w.recent.map((r) => {
                    const s = STATUS[r.status];
                    return (
                      <div key={r.id} className="sf-row" style={{ cursor: 'default' }}>
                        <div className="sf-row-main">
                          <div className="sf-row-name">{euro(r.amountCents)}</div>
                          <div className="sf-row-sub">
                            {shortDate(r.requestedAt)}
                            {r.paidAt ? ` · pagato ${shortDate(r.paidAt)}` : ''}
                          </div>
                        </div>
                        <span className="sf-pill" style={{ background: s[0], color: s[1] }}>
                          {s[2]}
                        </span>
                      </div>
                    );
                  })
                )}
              </Card>
            </>
          );
        }}
      </Async>
    </StaffShell>
  );
}
