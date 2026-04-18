import { useState } from 'react';
import { DEMO_EMAILS } from './data';
import { classifyEmail } from './ai';
import './InboxPage.css';

const OPPORTUNITY_TAG = {
  2: { type: 'Scholarship', color: 'badge-success' },
  4: { type: 'Startup Program', color: 'badge-warning' },
  6: { type: 'Research Fellowship', color: 'badge-accent' },
  8: { type: 'Internship', color: 'badge-primary' },
  10: { type: 'Competition', color: 'badge-danger' },
};

export default function InboxPage({ onNext, onEmailsReady }) {
  const [apiKey, setApiKey] = useState(() => import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || '');
  const [mode, setMode] = useState(null); // null | 'demo' | 'type' | 'inbox'

  // Shared email count (1–15), default 10
  const [emailCount, setEmailCount] = useState(10);
  const sliderPct = (n) => `${((n - 1) / (15 - 1)) * 100}%`;

  const [customEmails, setCustomEmails] = useState([
    { id: 'c1', subject: '', from: '', body: '' },
    { id: 'c2', subject: '', from: '', body: '' },
    { id: 'c3', subject: '', from: '', body: '' },
  ]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [running, setRunning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanIndex, setScanIndex] = useState(-1);
  const [scannedEmailsWithData, setScannedEmailsWithData] = useState([]);
  const [emailsBeingScanned, setEmailsBeingScanned] = useState([]);

  // The sliced set of demo emails based on emailCount
  const activeEmails = DEMO_EMAILS.slice(0, emailCount);
  // Display: show emails being scanned (with progressively added aiData) or final scanned results
  const displayEmails = emailsBeingScanned.length > 0 ? emailsBeingScanned : (scannedEmailsWithData.length > 0 ? scannedEmailsWithData : activeEmails);
  // Count opportunities from display emails
  const opportunitiesCount = displayEmails.filter(e => e.aiData?.isOpportunity).length;

  const addCustomEmail = () => {
    if (customEmails.length < 15) {
      setCustomEmails(prev => [...prev, { id: `c${Date.now()}`, subject: '', from: '', body: '' }]);
    }
  };

  const removeCustomEmail = (id) => {
    setCustomEmails(prev => prev.filter(e => e.id !== id));
  };

  const updateCustomEmail = (id, field, value) => {
    setCustomEmails(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const runScan = async (emails) => {
    setRunning(true);
    setScanned(false);
    setEmailsBeingScanned([...emails]); // Show all emails being scanned from start
    
    let scannedEmails = [];

    for (let i = 0; i < emails.length; i++) {
      setScanIndex(i);
      let aiData = null;
      if (apiKey) {
        // Use real AI
        aiData = await classifyEmail(emails[i], apiKey);
      } else {
        // Fallback simulated delay
        await new Promise(r => setTimeout(r, 280));
      }
      const emailWithData = { ...emails[i], aiData };
      scannedEmails.push(emailWithData);
      // Update the display with the new aiData attached to this email
      setEmailsBeingScanned(prev => 
        prev.map((e, idx) => idx === i ? emailWithData : e)
      );
    }
    
    setScanIndex(-1);
    setRunning(false);
    setScanned(true);
    setScannedEmailsWithData(scannedEmails); // Save final results for display
    setEmailsBeingScanned([]); // Done scanning, display will now use scannedEmailsWithData
    onEmailsReady(scannedEmails);
  };

  const handleDemoScan = () => runScan(activeEmails);

  const handleCustomScan = () => {
    const valid = customEmails.filter(e => e.subject.trim() && e.body.trim());
    if (valid.length < 1) return alert('Please fill in at least 1 email.');
    const formatted = valid.map(e => ({ ...e, isRead: false, time: 'Just now', _custom: true }));
    runScan(formatted);
  };

  const handleModeSelect = (m) => {
    setScanned(false);
    setSelectedEmail(null);
    setScanIndex(-1);
    setMode(m);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📬 Email Inbox Scanner</h1>
        <p>Paste your emails or use our demo inbox — the AI will detect real opportunities in seconds.</p>
      </div>

      {/* ── Mode Selector ── */}
      {!mode && (
        <div className="mode-grid">
          <button className="mode-card" id="btn-demo-inbox" onClick={() => handleModeSelect('demo')}>
            <div className="mode-icon">📧</div>
            <div className="mode-label">Use Demo Inbox</div>
            <div className="mode-desc">
              Scan pre-loaded realistic student emails — great for a quick demo.
            </div>
            <div className="mode-tag">Recommended</div>
          </button>
          <button className="mode-card" id="btn-type-emails" onClick={() => handleModeSelect('type')}>
            <div className="mode-icon">✏️</div>
            <div className="mode-label">Type / Paste Emails</div>
            <div className="mode-desc">Manually enter 1–15 emails you've received. Supports any format.</div>
          </button>
          <button className="mode-card" id="btn-connect-inbox" onClick={() => handleModeSelect('inbox')}>
            <div className="mode-icon">🔗</div>
            <div className="mode-label">Connect Inbox</div>
            <div className="mode-desc">Configure scan settings &amp; link your Gmail or Outlook account.</div>
            <div className="mode-tag mode-tag-soon">Coming Soon</div>
          </button>
        </div>
      )}

      {/* ── Demo Mode ── */}
      {mode === 'demo' && (
        <div className="inbox-container">
          <div className="inbox-toolbar">
            <button className="btn-ghost" onClick={() => { handleModeSelect(null); }}>← Back</button>
            <span className="inbox-count">{displayEmails.length} emails selected</span>
            {!scanned && (
              <button className="btn-primary" id="btn-run-scan" onClick={handleDemoScan} disabled={running}>
                {running ? <><span className="spinner"></span> Scanning…</> : <><span>🤖</span> Run AI Scan</>}
              </button>
            )}
            {scanned && (
              <button className="btn-primary" id="btn-next-profile" onClick={onNext}>
                ✨ Get Recommendations →
              </button>
            )}
          </div>

          <div className="inbox-layout">
            <div className="email-list">
              {displayEmails.map((email, i) => {
                const aiData = email.aiData;
                // Use AI classification
                const isOpp = aiData?.isOpportunity ?? false;
                const typeLabel = aiData?.type;
                
                const isScanning = running && scanIndex === i;
                const wasScanned = scanned || (running && scanIndex > i);
                return (
                  <div
                    key={email.id}
                    id={`email-row-${email.id}`}
                    className={`email-row ${!email.isRead ? 'unread' : ''} ${selectedEmail?.id === email.id ? 'selected' : ''} ${isScanning ? 'scanning' : ''} ${wasScanned && isOpp ? 'highlighted' : ''}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="email-row-left">
                      <div className="email-avatar">{email.from.charAt(0).toUpperCase()}</div>
                      <div className="email-info">
                        <div className="email-from-row">
                          <span className="email-from">{email.from.split('@')[0]}</span>
                          <span className="email-time">{email.time}</span>
                        </div>
                        <div className="email-subject">{email.subject}</div>
                        <div className="email-preview">{email.preview}</div>
                      </div>
                    </div>
                    <div className="email-row-right">
                      {wasScanned && isOpp && typeLabel && (
                        <span className="badge badge-success badge-opp">{typeLabel}</span>
                      )}
                      {wasScanned && !isOpp && (
                        <span className="badge badge-gray badge-opp">Not relevant</span>
                      )}
                      {isScanning && <span className="scan-spinner">⚡</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Email Preview */}
            <div className="email-preview-pane">
              {selectedEmail ? (
                <div className="preview-content">
                  <div className="preview-header">
                    <h3>{selectedEmail.subject}</h3>
                    <div className="preview-meta">
                      <span>From: <strong>{selectedEmail.from}</strong></span>
                      <span>{selectedEmail.time}</span>
                    </div>
                    {scanned && (selectedEmail.aiData?.isOpportunity ?? false) && (
                      <div className="preview-opp-banner">
                        ✅ Real Opportunity Detected — <strong>{selectedEmail.aiData?.type}</strong>
                        {selectedEmail.aiData && selectedEmail.aiData.reasoning && (
                          <div style={{marginTop: '4px', fontSize: '0.75rem', fontWeight: 400}}>
                            {selectedEmail.aiData.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                    {scanned && !(selectedEmail.aiData?.isOpportunity ?? false) && (
                      <div className="preview-skip-banner">
                        ⛔ Filtered Out — {selectedEmail.aiData?.reasoning ?? "Not an opportunity"}
                      </div>
                    )}
                  </div>
                  <pre className="preview-body">{selectedEmail.body}</pre>
                </div>
              ) : (
                <div className="preview-empty">
                  <div className="preview-empty-icon">📨</div>
                  <p>Click an email to preview</p>
                </div>
              )}
            </div>
          </div>

          {scanned && (
            <div className="scan-summary">
              <div className="scan-summary-item scan-success">
                <span className="ss-num">{opportunitiesCount}</span>
                <span className="ss-label">Real Opportunities Found</span>
              </div>
              <div className="scan-summary-item scan-muted">
                <span className="ss-num">{displayEmails.length - opportunitiesCount}</span>
                <span className="ss-label">Emails Filtered Out</span>
              </div>
              <div className="scan-summary-item scan-info">
                <span className="ss-num">{displayEmails.length}</span>
                <span className="ss-label">Total Emails Scanned</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Type Mode ── */}
      {mode === 'type' && (
        <div className="type-container">
          <div className="inbox-toolbar">
            <button className="btn-ghost" onClick={() => { handleModeSelect(null); }}>← Back</button>
            <span className="inbox-count">{customEmails.length} / 15 emails</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {customEmails.length < 15 && (
                <button className="btn-secondary" id="btn-add-email" onClick={addCustomEmail}>+ Add Email</button>
              )}
              {!scanned && (
                <button className="btn-primary" id="btn-scan-custom" onClick={handleCustomScan} disabled={running}>
                  {running ? <><span className="spinner"></span> Scanning…</> : <><span>🤖</span> Run AI Scan</>}
                </button>
              )}
              {scanned && (
                <button className="btn-primary" id="btn-next-profile-custom" onClick={onNext}>
                  ✨ Get Recommendations →
                </button>
              )}
            </div>
          </div>

          <div className="custom-emails-list">
            {customEmails.map((email, i) => (
              <div key={email.id} className="custom-email-card card">
                <div className="custom-email-header">
                  <span className="custom-email-num">Email #{i + 1}</span>
                  {customEmails.length > 1 && (
                    <button className="btn-ghost remove-btn" onClick={() => removeCustomEmail(email.id)}>✕ Remove</button>
                  )}
                </div>
                <div className="custom-email-fields">
                  <div className="field-row">
                    <label>From (sender email)</label>
                    <input
                      type="text"
                      placeholder="e.g. scholarship@hec.gov.pk"
                      value={email.from}
                      onChange={e => updateCustomEmail(email.id, 'from', e.target.value)}
                    />
                  </div>
                  <div className="field-row">
                    <label>Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. HEC Need-Based Scholarship 2025 – Applications Open"
                      value={email.subject}
                      onChange={e => updateCustomEmail(email.id, 'subject', e.target.value)}
                    />
                  </div>
                  <div className="field-row">
                    <label>Email Body</label>
                    <textarea
                      placeholder="Paste the full email content here…"
                      rows={5}
                      value={email.body}
                      onChange={e => updateCustomEmail(email.id, 'body', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Connect Inbox Mode ── */}
      {mode === 'inbox' && (
        <div className="connect-container card">
          <button className="btn-ghost" onClick={() => handleModeSelect(null)} style={{ alignSelf: 'flex-start' }}>← Back</button>

          <div className="connect-icon">📬</div>
          <h2>Connect Your Inbox</h2>
          <p>OAuth inbox integration is coming soon. While you wait, you can configure how many emails the demo scanner will pull.</p>

          {/* Email Count — mirrored here in Connect Inbox */}
          <div className="connect-count-block">
            <div className="connect-count-header">
              <span>📊 Emails to scan</span>
              <span className="count-pill">{emailCount} email{emailCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="count-slider-wrap">
              <span className="slider-edge">1</span>
              <input
                id="connect-count-slider"
                type="range"
                min={1}
                max={15}
                step={1}
                value={emailCount}
                onChange={e => setEmailCount(Number(e.target.value))}
                className="count-slider"
                style={{
                  background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${sliderPct(emailCount)}, var(--gray-200) ${sliderPct(emailCount)}, var(--gray-200) 100%)`
                }}
              />
              <span className="slider-edge">15</span>
            </div>
            <p className="connect-count-hint">
              This will also update the Demo Inbox to scan exactly <strong>{emailCount}</strong> emails.
            </p>
          </div>

          <div className="connect-providers">
            <div className="connect-provider disabled"><span>G</span> Gmail — Coming Soon</div>
            <div className="connect-provider disabled"><span>O</span> Outlook — Coming Soon</div>
          </div>

          <button className="btn-secondary" onClick={() => handleModeSelect('demo')} style={{ marginTop: '0.5rem' }}>
            → Use Demo Inbox with {emailCount} Emails
          </button>
        </div>
      )}
    </div>
  );
}
