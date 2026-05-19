// All section components for the panel
const { useState, useMemo } = React;

// ---------- Small primitives ----------
function Sparkline({ data, color = 'var(--lz-primary)', width = 80, height = 28 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="kpi-spark" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--lz-bg)',        fg: 'var(--lz-text-muted)', bd: 'var(--lz-border)' },
    opp:     { bg: 'var(--lz-success-bg)',fg: 'var(--lz-success)',    bd: 'var(--lz-success)' },
    risk:    { bg: 'var(--lz-danger-bg)', fg: 'var(--lz-danger)',     bd: 'var(--lz-danger)' },
    corr:    { bg: 'var(--lz-purple-bg)', fg: 'var(--lz-purple)',     bd: 'var(--lz-purple)' },
    news:    { bg: 'var(--lz-info-bg)',   fg: 'var(--lz-info)',       bd: 'var(--lz-info)' },
    warm:    { bg: 'var(--lz-primary-light)', fg: 'var(--lz-primary-dark)', bd: 'var(--lz-primary)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 'var(--lz-radius-pill)',
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}33`,
      fontSize: 'var(--lz-fs-2xs)', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.3px',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Ticker({ children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px',
      background: 'var(--lz-bg)', color: 'var(--lz-text)',
      fontFamily: 'var(--lz-font-mono)', fontSize: 11, fontWeight: 700,
      borderRadius: 4, border: '1px solid var(--lz-border)',
      letterSpacing: '0.3px',
    }}>{children}</span>
  );
}

// ---------- Page header ----------
function PageHead({ onAction }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Günaydın 👋</h1>
        <p className="page-sub">Bugün 47 sinyal işlendi · 8 fırsat, 3 risk uyarısı aktif.</p>
      </div>
      <div className="page-head-actions">
        <button className="btn btn-ghost" onClick={() => onAction('refresh')}>
          🔄 Yenile
        </button>
        <button className="btn btn-ghost" onClick={() => onAction('export')}>
          📥 Brifing İndir
        </button>
        <button className="btn btn-primary" onClick={() => onAction('telegram')}>
          ✈️ Telegram'a Gönder
        </button>
      </div>
    </div>
  );
}

// ---------- KPI row ----------
function KpiRow() {
  return (
    <div className="kpis">
      {KPIS.map(k => (
        <div key={k.id} className="card kpi">
          <div className={`kpi-icon ${k.tone}`}>{k.icon}</div>
          <div className="kpi-eyebrow">{k.eyebrow}</div>
          <div className="kpi-value">
            {k.value}<span className="kpi-unit">{k.unit}</span>
          </div>
          <div className="kpi-foot">
            <span className={k.trend === 'up' ? 'delta-up' : 'delta-down'}>
              {k.trend === 'up' ? '▲' : '▼'} {k.delta}
            </span>
            <span>· Dünden</span>
          </div>
          <Sparkline data={k.spark} color={
            k.tone === 'green' ? 'var(--lz-success)' :
            k.tone === 'red'   ? 'var(--lz-danger)'  :
            k.tone === 'amber' ? 'var(--lz-warning)' :
            'var(--lz-primary)'
          } />
        </div>
      ))}
    </div>
  );
}

// ---------- Pipeline ----------
function PipelineCard() {
  return (
    <section className="card" data-section="dashboard">
      <div className="card-head">
        <div>
          <h2 className="card-title">Sistem Pipeline'ı</h2>
          <p className="card-sub">Veriden aksiyona giden 4 katmanlı otonom yapı</p>
        </div>
        <div className="card-head-actions">
          <Pill tone="opp">● Çalışıyor</Pill>
        </div>
      </div>
      <div className="card-body">
        <div className="pipeline">
          {PIPELINE.map(s => (
            <div key={s.num} className={`pipe-stage ${s.active ? 'is-active' : ''}`}>
              <div className="pipe-num">{s.num}</div>
              <div className="pipe-title">{s.title}</div>
              <ul className="pipe-items">
                {s.items.map(it => <li key={it} className="pipe-item">{it}</li>)}
              </ul>
              <div className="pipe-foot">{s.foot}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Signal feed ----------
function SignalCard({ signal, onAct }) {
  const toneByKind = { opp: 'opp', risk: 'risk', corr: 'corr', news: 'news' };
  const labelByKind = { opp: 'Fırsat', risk: 'Risk', corr: 'Korelasyon', news: 'Haber' };
  return (
    <div className="signal" data-read={signal.read}>
      <div className="signal-icon">{signal.emoji}</div>
      <div className="signal-body">
        <div className="signal-head">
          <Pill tone={toneByKind[signal.kind]}>{labelByKind[signal.kind]}</Pill>
          {signal.tickers.map(t => <Ticker key={t}>{t}</Ticker>)}
          <span className="signal-time">⏱️ {signal.time}</span>
          {!signal.read && <span className="signal-unread" title="Okunmadı" />}
        </div>
        <div className="signal-title">{signal.title}</div>
        <div className="signal-text">{signal.body}</div>
        <div className="signal-foot">
          <span className="signal-source">📍 {signal.source}</span>
          <div className="signal-score">
            <span className="lz-eyebrow">Önem</span>
            <div className="score-bar"><div className="score-fill" style={{ width: signal.score + '%' }} /></div>
            <span className="score-val">{signal.score}</span>
          </div>
        </div>
      </div>
      <div className="signal-actions">
        <button className="btn-icon" title="Telegram'a gönder" onClick={() => onAct('telegram', signal)}>✈️</button>
        <button className="btn-icon" title="Notion'a kaydet" onClick={() => onAct('notion', signal)}>🗃️</button>
        <button className="btn-icon" title={signal.read ? 'Okundu' : 'Okundu olarak işaretle'} onClick={() => onAct('read', signal)}>✓</button>
      </div>
    </div>
  );
}

function SignalFeedCard({ signals, filter, setFilter, onAct }) {
  const filters = [
    { id: 'all',  label: 'Tümü',       count: signals.length },
    { id: 'opp',  label: 'Fırsat',     count: signals.filter(s => s.kind === 'opp').length },
    { id: 'risk', label: 'Risk',       count: signals.filter(s => s.kind === 'risk').length },
    { id: 'corr', label: 'Korelasyon', count: signals.filter(s => s.kind === 'corr').length },
    { id: 'news', label: 'Haber',      count: signals.filter(s => s.kind === 'news').length },
  ];
  const shown = filter === 'all' ? signals : signals.filter(s => s.kind === filter);
  return (
    <section className="card" data-section="signals">
      <div className="card-head">
        <div>
          <h2 className="card-title">Canlı Sinyal Akışı</h2>
          <p className="card-sub">İçgörü motorundan gerçek zamanlı çıktılar</p>
        </div>
        <div className="card-head-actions">
          <button className="btn btn-ghost btn-sm">Tümünü gör →</button>
        </div>
      </div>
      <div className="signal-filters">
        {filters.map(f => (
          <button key={f.id}
            className={`filter-tab ${filter === f.id ? 'is-on' : ''}`}
            onClick={() => setFilter(f.id)}>
            {f.label} <span className="filter-count">{f.count}</span>
          </button>
        ))}
      </div>
      <ul className="signal-list">
        {shown.length === 0 && <li className="signal-empty">Bu filtrede sinyal yok ✨</li>}
        {shown.map(s => <li key={s.id}><SignalCard signal={s} onAct={onAct} /></li>)}
      </ul>
    </section>
  );
}

// ---------- Sources grid ----------
function SourcesCard() {
  const statusMeta = {
    live: { label: 'Canlı', color: 'var(--lz-success)', bg: 'var(--lz-success-bg)' },
    idle: { label: 'Bekliyor', color: 'var(--lz-text-muted)', bg: 'var(--lz-bg)' },
    warn: { label: 'Gecikme', color: 'var(--lz-warning)', bg: 'var(--lz-warning-bg)' },
  };
  return (
    <section className="card" data-section="sources">
      <div className="card-head">
        <div>
          <h2 className="card-title">Veri Kaynakları</h2>
          <p className="card-sub">Sistemin beslendiği 10 temel bilgi akışı</p>
        </div>
        <div className="card-head-actions">
          <button className="btn btn-ghost btn-sm">⚙️ Yönet</button>
        </div>
      </div>
      <div className="sources-grid">
        {SOURCES.map(src => {
          const m = statusMeta[src.status];
          return (
            <div key={src.no} className="source-row">
              <div className="source-no">{src.no}</div>
              <div className="source-emoji">{src.emoji}</div>
              <div className="source-text">
                <div className="source-name">{src.name}</div>
                <div className="source-sub">{src.sub}</div>
              </div>
              <div className="source-meta">
                <span className="source-rate"><b>{src.rate}</b><span>/saat</span></span>
                <span className="source-status" style={{ color: m.color, background: m.bg }}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Right column — activity, actions, briefings ----------
function QuickActionsCard({ onAct }) {
  const actions = [
    { id: 'telegram', emoji: '✈️', label: 'Telegram\'a Anlık Uyarı',      sub: 'Seçili sinyalleri gönder' },
    { id: 'morning',  emoji: '☀️', label: 'Sabah Brifingi Oluştur',       sub: 'Son 24 saatten özet' },
    { id: 'notion',   emoji: '🗃️', label: 'Notion\'a Arşivle',            sub: 'Bugünkü içgörüleri' },
    { id: 'weekly',   emoji: '📅', label: 'Haftalık Özet Hazırla',        sub: 'Pazar 20:00 için' },
    { id: 'tune',     emoji: '🎚️', label: 'Sinyal Eşiklerini Ayarla',     sub: 'Önem skoru filtresi' },
  ];
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">Hızlı Aksiyonlar</h3>
      </div>
      <ul className="actions-list">
        {actions.map(a => (
          <li key={a.id}>
            <button className="action-btn" onClick={() => onAct(a.id)}>
              <span className="action-emoji">{a.emoji}</span>
              <span className="action-text">
                <span className="action-label">{a.label}</span>
                <span className="action-sub">{a.sub}</span>
              </span>
              <span className="action-chev">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityCard() {
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">Son Aktivite</h3>
      </div>
      <ul className="activity-list">
        {ACTIVITY.map((a, i) => (
          <li key={i} className="activity-row">
            <span className="activity-emoji">{a.emoji}</span>
            <span className="activity-text">{a.text}</span>
            <span className="activity-time">{a.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BriefingsCard() {
  return (
    <section className="card" data-section="reports">
      <div className="card-head">
        <div>
          <h3 className="card-title">Raporlar & Brifingler</h3>
          <p className="card-sub">Otomatik üretilen özetler</p>
        </div>
        <div className="card-head-actions">
          <button className="btn btn-ghost btn-sm">+ Yeni</button>
        </div>
      </div>
      <ul className="brief-list">
        {BRIEFINGS.map(b => (
          <li key={b.id} className="brief-row">
            <div className="brief-icon">{b.kind === 'morning' ? '☀️' : '📅'}</div>
            <div className="brief-text">
              <div className="brief-title">{b.title}</div>
              <div className="brief-meta">{b.time} · {b.items} içgörü</div>
            </div>
            <button className="btn-icon" title="Aç">›</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Toast (simple) ----------
function Toast({ msg, onClose }) {
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

// expose to global
Object.assign(window, {
  Sparkline, Pill, Ticker,
  PageHead, KpiRow, PipelineCard, SignalFeedCard, SourcesCard,
  QuickActionsCard, ActivityCard, BriefingsCard, Toast,
});
