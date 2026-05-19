// Main app — wires everything together
function App() {
  const [signals, setSignals] = React.useState(SIGNALS);
  const [filter, setFilter]   = React.useState('all');
  const [toast, setToast]     = React.useState(null);

  const onAct = (kind, signal) => {
    if (kind === 'read' && signal) {
      setSignals(s => s.map(x => x.id === signal.id ? { ...x, read: !x.read } : x));
      setToast(signal.read ? 'Okunmadı olarak işaretlendi' : 'Okundu olarak işaretlendi ✓');
      return;
    }
    if (kind === 'telegram' && signal) { setToast(`📨 ${signal.tickers.join(', ')} sinyali Telegram'a gönderildi`); return; }
    if (kind === 'notion'   && signal) { setToast(`🗃️ ${signal.title.slice(0, 28)}… Notion'a kaydedildi`); return; }
    // top-level actions
    if (kind === 'telegram') { setToast('📨 Tüm aktif sinyaller Telegram\'a gönderildi'); return; }
    if (kind === 'morning')  { setToast('☀️ Sabah brifingi oluşturuluyor…'); return; }
    if (kind === 'notion')   { setToast('🗃️ Bugünkü içgörüler Notion\'a arşivlendi'); return; }
    if (kind === 'weekly')   { setToast('📅 Haftalık özet kuyruğa eklendi'); return; }
    if (kind === 'tune')     { setToast('🎚️ Eşik ayarları ekranı yakında'); return; }
    if (kind === 'refresh')  { setToast('🔄 Veri kaynakları yenilendi'); return; }
    if (kind === 'export')   { setToast('📥 Brifing PDF indiriliyor…'); return; }
  };

  return (
    <React.Fragment>
      <PageHead onAction={onAct} />
      <KpiRow />
      <PipelineCard />
      <div className="two-col">
        <div className="col-left">
          <SignalFeedCard signals={signals} filter={filter} setFilter={setFilter} onAct={onAct} />
          <SourcesCard />
        </div>
        <aside className="col-right">
          <QuickActionsCard onAct={onAct} />
          <ActivityCard />
          <BriefingsCard />
        </aside>
      </div>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
