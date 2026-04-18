import { useEffect, useState } from 'react';
import { DEMO_EMAILS, OPPORTUNITY_IDS } from './data';
import { classifyEmail } from './ai';
import './InboxPage.css';

const OPPORTUNITY_TAG = {
  2: { type: 'Scholarship', color: 'badge-success' },
  4: { type: 'Startup Program', color: 'badge-warning' },
  6: { type: 'Research Fellowship', color: 'badge-accent' },
  8: { type: 'Internship', color: 'badge-primary' },
  10: { type: 'Competition', color: 'badge-danger' },
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const OPEN_CONNECT_INBOX_FLAG = 'OPEN_CONNECT_INBOX';

const normalizeOpportunityType = (type = '') =>
  String(type)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatContactInfo = (contact = {}) => {
  const emails = Array.isArray(contact.emails) ? contact.emails : [];
  const phones = Array.isArray(contact.phones) ? contact.phones : [];
  return [...emails, ...phones].join(' | ');
};

const getPreviewText = (summary = '', body = '') => {
  const source = summary || body || '';
  return source.length > 120 ? `${source.slice(0, 117)}...` : source;
};

const buildFrontendEmailFromOpportunity = (opp, idx) => {
  const type = normalizeOpportunityType(opp.opportunity_type || 'opportunity');
  const summary = opp.summary_text || '';
  const body = [summary, opp.deadline ? `Deadline: ${opp.deadline}` : '']
    .filter(Boolean)
    .join('\n\n');

  return {
    id: `g-${opp.message_id || idx}`,
    from: opp.from || 'unknown@unknown.com',
    subject: opp.subject || 'No subject',
    preview: getPreviewText(summary, body),
    time: opp.date || 'Recent',
    body,
    isRead: false,
    _gmail: true,
    aiData: {
      isOpportunity: true,
      type,
      confidence: 95,
      reasoning: 'Filtered as an opportunity by Gmail backend extraction.',
      extracted: {
        deadline: opp.deadline || 'Not specified',
        eligibility: opp.eligibility_conditions || [],
        requiredDocs: opp.required_documents || [],
        contact: formatContactInfo(opp.application_contact_information),
        applyLink: null,
      },
    },
  };
};

const buildOAuthRedirectUri = () => {
  const basePath = `${window.location.origin}${window.location.pathname}`;
  return `${basePath}?gmail_oauth=1`;
};

export default function InboxPage({ onNext, onEmailsReady, gmailAuth, setGmailAuth }) {
  const [apiKey, setApiKey] = useState(() => import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || '');
  const [mode, setMode] = useState(null); // null | 'demo' | 'type' | 'inbox'
  const [oauthStarting, setOauthStarting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [gmailOpportunityEmails, setGmailOpportunityEmails] = useState([]);
  const [gmailMeta, setGmailMeta] = useState(null);

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

  const usingGmailOpportunities = gmailOpportunityEmails.length > 0;

  // The emails shown in Demo Inbox: Gmail opportunities if available, otherwise local demo emails.
  const activeEmails = usingGmailOpportunities
    ? gmailOpportunityEmails.slice(0, emailCount)
    : DEMO_EMAILS.slice(0, emailCount);

  const totalScannedCount = gmailMeta?.messages_scanned || activeEmails.length;
  const opportunityCount = usingGmailOpportunities
    ? activeEmails.length
    : activeEmails.map((e) => e.id).filter((id) => OPPORTUNITY_IDS.includes(id)).length;
  const filteredOutCount = Math.max(totalScannedCount - opportunityCount, 0);
  const canProceedDemo = scanned || usingGmailOpportunities;

  useEffect(() => {
    if (gmailAuth?.connected && gmailAuth?.gmailAddress) {
      setConnectSuccess(`Connected to ${gmailAuth.gmailAddress}`);
      setConnectError('');
    }
  }, [gmailAuth]);

  useEffect(() => {
    if (sessionStorage.getItem(OPEN_CONNECT_INBOX_FLAG) === '1') {
      setMode('inbox');
      sessionStorage.removeItem(OPEN_CONNECT_INBOX_FLAG);
    }
  }, []);

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
      scannedEmails.push({ ...emails[i], aiData });
    }
    
    setScanIndex(-1);
    setRunning(false);
    setScanned(true);
    onEmailsReady(scannedEmails);
  };

  const handleDemoScan = () => runScan(activeEmails);

  const handleConnectGmail = async () => {
    setOauthStarting(true);
    setConnectError('');
    setConnectSuccess('');
    setGmailAuth((prev) => ({ ...prev, busy: true, error: '' }));

    try {
      const response = await fetch(`${API_BASE}/api/gmail/oauth/start/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect_uri: buildOAuthRedirectUri(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.auth_url) {
        throw new Error(data?.error || `OAuth start failed with status ${response.status}`);
      }

      window.location.assign(data.auth_url);
    } catch (err) {
      const msg = err?.message || 'Unable to start Gmail OAuth flow.';
      setConnectError(msg);
      setGmailAuth((prev) => ({ ...prev, busy: false, error: msg }));
      setOauthStarting(false);
    }
  };

  const handleFetchGmailOpportunities = async () => {
    setExtracting(true);
    setConnectError('');
    setConnectSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/gmail/opportunities/extract/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_count: emailCount,
          query: '',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Extract failed with status ${response.status}`);
      }

      const opportunities = data?.result?.opportunities || [];
      const mapped = opportunities.map((opp, idx) => buildFrontendEmailFromOpportunity(opp, idx));

      setGmailMeta(data?.result?.meta || null);
      setGmailOpportunityEmails(mapped);
      setScanned(true);
      setScanIndex(-1);
      setSelectedEmail(mapped[0] || null);
      onEmailsReady(mapped);
      setMode('demo');

      setConnectSuccess(
        mapped.length
          ? `Loaded ${mapped.length} opportunity emails from Gmail.`
          : 'No opportunity emails were found in the scanned set.'
      );
    } catch (err) {
      const msg = err?.message || 'Failed to retrieve opportunity emails from Gmail.';
      setConnectError(msg);
      if (msg.toLowerCase().includes('connect oauth first')) {
        setGmailAuth((prev) => ({
          ...prev,
          connected: false,
        }));
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleCustomScan = () => {
    const valid = customEmails.filter(e => e.subject.trim() && e.body.trim());
    if (valid.length < 1) return alert('Please fill in at least 1 email.');
    const formatted = valid.map(e => ({ ...e, isRead: false, time: 'Just now', _custom: true }));
    runScan(formatted);
  };

  const handleModeSelect = (m) => {
    if (m !== 'demo' || !usingGmailOpportunities) {
      setScanned(false);
    }
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
            <span className="inbox-count">
              {usingGmailOpportunities
                ? `${activeEmails.length} opportunities from Gmail`
                : `${activeEmails.length} emails selected`}
            </span>
            {!canProceedDemo && (
              <button className="btn-primary" id="btn-run-scan" onClick={handleDemoScan} disabled={running}>
                {running ? <><span className="spinner"></span> Scanning…</> : <><span>🤖</span> Run AI Scan</>}
              </button>
            )}
            {canProceedDemo && (
              <button className="btn-primary" id="btn-next-profile" onClick={onNext}>
                Next: My Profile →
              </button>
            )}
          </div>

          <div className="inbox-layout">
            <div className="email-list">
              {activeEmails.map((email, i) => {
                const aiData = email.aiData;
                // If we ran AI, use its determination. Otherwise fallback to hardcoded IDs.
                const isOpp = aiData ? aiData.isOpportunity : OPPORTUNITY_IDS.includes(email.id);
                const typeLabel = aiData ? aiData.type : OPPORTUNITY_TAG[email.id]?.type;
                const senderName = (email.from || '').includes('@')
                  ? email.from.split('@')[0]
                  : (email.from || 'unknown');
                
                const isScanning = running && scanIndex === i;
                const wasScanned = canProceedDemo || (running && scanIndex > i);
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
                          <span className="email-from">{senderName}</span>
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
                    {canProceedDemo && (selectedEmail.aiData ? selectedEmail.aiData.isOpportunity : OPPORTUNITY_IDS.includes(selectedEmail.id)) && (
                      <div className="preview-opp-banner">
                        ✅ Real Opportunity Detected — <strong>{selectedEmail.aiData ? selectedEmail.aiData.type : OPPORTUNITY_TAG[selectedEmail.id]?.type}</strong>
                        {selectedEmail.aiData && selectedEmail.aiData.reasoning && (
                          <div style={{marginTop: '4px', fontSize: '0.75rem', fontWeight: 400}}>
                            {selectedEmail.aiData.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                    {canProceedDemo && !(selectedEmail.aiData ? selectedEmail.aiData.isOpportunity : OPPORTUNITY_IDS.includes(selectedEmail.id)) && (
                      <div className="preview-skip-banner">
                        ⛔ Filtered Out — {selectedEmail.aiData ? selectedEmail.aiData.reasoning : "Not an opportunity"}
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

          {canProceedDemo && (
            <div className="scan-summary">
              <div className="scan-summary-item scan-success">
                <span className="ss-num">{opportunityCount}</span>
                <span className="ss-label">Real Opportunities Found</span>
              </div>
              <div className="scan-summary-item scan-muted">
                <span className="ss-num">{filteredOutCount}</span>
                <span className="ss-label">Emails Filtered Out</span>
              </div>
              <div className="scan-summary-item scan-info">
                <span className="ss-num">{totalScannedCount}</span>
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
                  Next: My Profile →
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
          <p>Connect Gmail with OAuth, then retrieve filtered opportunity emails directly from backend extraction.</p>

          {(gmailAuth?.busy || oauthStarting) && (
            <div className="preview-skip-banner">Starting Gmail OAuth...</div>
          )}
          {gmailAuth?.connected && gmailAuth?.gmailAddress && (
            <div className="preview-opp-banner">Connected Gmail: <strong>{gmailAuth.gmailAddress}</strong></div>
          )}
          {(connectError || gmailAuth?.error) && (
            <div className="preview-skip-banner">{connectError || gmailAuth.error}</div>
          )}
          {connectSuccess && <div className="preview-opp-banner">{connectSuccess}</div>}

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
              Backend will scan up to <strong>{emailCount}</strong> Gmail emails before showing filtered opportunities.
            </p>
          </div>

          <div className="connect-providers">
            <button
              className="connect-provider"
              onClick={handleConnectGmail}
              disabled={oauthStarting || gmailAuth?.busy}
            >
              <span>G</span>
              {oauthStarting || gmailAuth?.busy ? ' Starting OAuth...' : ' Connect Gmail'}
            </button>
            <button
              className="connect-provider"
              onClick={handleFetchGmailOpportunities}
              disabled={extracting || gmailAuth?.busy || oauthStarting}
            >
              <span>📊</span>
              {extracting ? ' Retrieving emails...' : ' Emails to scan'}
            </button>
          </div>

          <button className="btn-secondary" onClick={() => handleModeSelect('demo')} style={{ marginTop: '0.5rem' }}>
            → Use Demo Inbox
          </button>
        </div>
      )}
    </div>
  );
}
