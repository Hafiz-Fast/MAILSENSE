import { useEffect, useState } from 'react';
import { DEMO_EMAILS, OPPORTUNITY_IDS } from './data';
import { classifyEmail, classifyEmailHeuristic } from './ai';
import { motion } from 'framer-motion';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
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

const getPreviewText = (summary = '', body = '') => {
  const source = summary || body || '';
  return source.length > 120 ? `${source.slice(0, 117)}...` : source;
};

const buildFrontendEmailFromFetchedEmail = (email, idx) => {
  const body = email.body || email.snippet || '';
  const previewSource = email.snippet || body;

  return {
    id: `g-${email.message_id || idx}`,
    from: email.from || 'unknown@unknown.com',
    subject: email.subject || 'No subject',
    preview: getPreviewText(previewSource, body),
    time: email.date || 'Recent',
    body,
    isRead: false,
    _gmail: true,
  };
};

const buildFrontendEmailFromOpportunityFallback = (opp, idx) => {
  const body = [opp.summary_text || '', opp.deadline ? `Deadline: ${opp.deadline}` : '']
    .filter(Boolean)
    .join('\n\n');

  return {
    id: `g-${opp.message_id || idx}`,
    from: opp.from || 'unknown@unknown.com',
    subject: opp.subject || 'No subject',
    preview: getPreviewText(opp.summary_text || '', body),
    time: opp.date || 'Recent',
    body,
    isRead: false,
    _gmail: true,
  };
};

const buildOAuthRedirectUri = () => {
  const basePath = `${window.location.origin}${window.location.pathname}`;
  return `${basePath}?gmail_oauth=1`;
};

const mailboxLabel = (mailbox) => {
  if (mailbox === 'spam') return 'Spam';
  if (mailbox === 'both') return 'Inbox + Spam';
  return 'Inbox';
};

export default function InboxPage({ onNext, onEmailsReady, gmailAuth, setGmailAuth, profile }) {
  const [scanMethod, setScanMethod] = useState(null); // null | 'ai' | 'heuristic'
  const [mode, setMode] = useState(null); // null | 'demo' | 'type' | 'inbox'
  const [oauthStarting, setOauthStarting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingMailbox, setExtractingMailbox] = useState(null);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [gmailFetchedEmails, setGmailFetchedEmails] = useState([]);
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
  const [scannedEmailsWithData, setScannedEmailsWithData] = useState([]);
  const [emailsBeingScanned, setEmailsBeingScanned] = useState([]);

  const usingGmailFetchedEmails = gmailFetchedEmails.length > 0;
  const canRetrieveFromGmail = Boolean(gmailAuth?.connected) && !gmailAuth?.busy && !oauthStarting;

  // The emails shown in Demo Inbox: retrieved Gmail emails if available, otherwise local demo emails.
  const activeEmails = usingGmailFetchedEmails
    ? gmailFetchedEmails.slice(0, emailCount)
    : DEMO_EMAILS.slice(0, emailCount);

  // Display: show emails being scanned (with progressively added aiData) or final scanned results.
  const displayEmails = emailsBeingScanned.length > 0
    ? emailsBeingScanned
    : (scannedEmailsWithData.length > 0 ? scannedEmailsWithData : activeEmails);

  // If we already have aiData (from completed AI scan), trust it.
  const opportunityCount = displayEmails.filter(
    (e) => (e.aiData ? e.aiData.isOpportunity : OPPORTUNITY_IDS.includes(e.id))
  ).length;
  const totalScannedCount = scanned
    ? (gmailMeta?.messages_scanned || scannedEmailsWithData.length || displayEmails.length)
    : 0;
  const filteredOutCount = Math.max(totalScannedCount - opportunityCount, 0);
  const canProceedDemo = scanned;

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

  const runScan = async (emails, method = 'ai') => {
    setRunning(true);
    setScanned(false);
    setScanMethod(method);
    setEmailsBeingScanned([...emails]); // Show all emails being scanned from start
    
    let scannedEmails = [];

    for (let i = 0; i < emails.length; i++) {
      setScanIndex(i);
      let aiData;
      if (method === 'heuristic') {
        aiData = await classifyEmailHeuristic(emails[i], profile);
      } else {
        aiData = await classifyEmail(emails[i]);
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

  const handleDemoScanAI = () => runScan(activeEmails, 'ai');
  const handleDemoScanHeuristic = () => runScan(activeEmails, 'heuristic');

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

  const handleFetchGmailOpportunities = async (mailbox = 'inbox') => {
    if (!gmailAuth?.connected) {
      const msg = 'Connect Gmail first before retrieving emails.';
      setConnectError(msg);
      setConnectSuccess('');
      return;
    }

    setExtracting(true);
    setExtractingMailbox(mailbox);
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
          mailbox,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Extract failed with status ${response.status}`);
      }

      const fetchedEmails = data?.result?.emails || [];
      const opportunities = data?.result?.opportunities || [];
      const mapped = fetchedEmails.length
        ? fetchedEmails.map((email, idx) => buildFrontendEmailFromFetchedEmail(email, idx))
        : opportunities.map((opp, idx) => buildFrontendEmailFromOpportunityFallback(opp, idx));

      setGmailMeta(data?.result?.meta || null);
      setGmailFetchedEmails(mapped);
      setScanned(false);
      setScannedEmailsWithData([]);
      setEmailsBeingScanned([]);
      setScanIndex(-1);
      setSelectedEmail(mapped[0] || null);
      setMode('demo');

      setConnectSuccess(
        mapped.length
          ? `Loaded ${mapped.length} emails from Gmail ${mailboxLabel(mailbox)}. Choose Run AI Scan or Run Heuristic Scan.`
          : `No emails were found in Gmail ${mailboxLabel(mailbox)} for this query.`
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
      setExtractingMailbox(null);
    }
  };

  const handleCustomScan = () => {
    const valid = customEmails.filter(e => e.subject.trim() && e.body.trim());
    if (valid.length < 1) return alert('Please fill in at least 1 email.');
    const formatted = valid.map(e => ({ ...e, isRead: false, time: 'Just now', _custom: true }));
    runScan(formatted);
  };

  const handleModeSelect = (m) => {
    if (m !== 'demo' || !usingGmailFetchedEmails) {
      setScanned(false);
    }
    setSelectedEmail(null);
    setScanIndex(-1);
    setMode(m);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }} 
      transition={{ duration: 0.4 }}
      className="page-wrapper"
    >
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
              {usingGmailFetchedEmails
                ? `${activeEmails.length} emails retrieved from Gmail`
                : `${activeEmails.length} emails selected`}
            </span>
            {!canProceedDemo && (
              <>
                <button className="btn-primary" id="btn-run-scan-ai" onClick={handleDemoScanAI} disabled={running}>
                  {running ? <><span className="spinner"></span> Scanning…</> : <><span>🤖</span> Run AI Scan</>}
                </button>
                <button className="btn-secondary" id="btn-run-scan-heuristic" onClick={handleDemoScanHeuristic} disabled={running}>
                  {running ? <><span className="spinner"></span> Scanning…</> : <><span>🧭</span> Run Heuristic Scan</>}
                </button>
              </>
            )}
            {canProceedDemo && (
              <button className="btn-primary" id="btn-next-profile" onClick={onNext}>
                ✨ Get Recommendations →
              </button>
            )}
          </div>

          <div className="inbox-layout">
            <div className="email-list">
              {displayEmails.map((email, i) => {
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
              {running && !selectedEmail ? (
                <div style={{ padding: '2rem' }}>
                  <Skeleton baseColor="var(--panel-bg)" highlightColor="var(--border-color)" count={1} height={40} style={{ marginBottom: '1rem' }} />
                  <Skeleton baseColor="var(--panel-bg)" highlightColor="var(--border-color)" count={2} height={20} style={{ marginBottom: '0.5rem' }} />
                  <br />
                  <Skeleton baseColor="var(--panel-bg)" highlightColor="var(--border-color)" count={15} height={16} style={{ marginBottom: '0.5rem' }} />
                </div>
              ) : selectedEmail ? (
                <div className="preview-content">
                  <div className="preview-header">
                    <h3>{selectedEmail.subject}</h3>
                    <div className="preview-meta">
                      <span>From: <strong>{selectedEmail.from}</strong></span>
                      <span>{selectedEmail.time}</span>
                    </div>
                    {canProceedDemo && (selectedEmail.aiData ? selectedEmail.aiData.isOpportunity : OPPORTUNITY_IDS.includes(selectedEmail.id)) && (
                      <div className="preview-opp-banner">
                        ✅ Real Opportunity Detected — <strong>{selectedEmail.aiData?.type}</strong>
                        {selectedEmail.aiData && selectedEmail.aiData.reasoning && (
                          <div style={{marginTop: '4px', fontSize: '0.75rem', fontWeight: 400}}>
                            {selectedEmail.aiData.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                    {canProceedDemo && !(selectedEmail.aiData ? selectedEmail.aiData.isOpportunity : OPPORTUNITY_IDS.includes(selectedEmail.id)) && (
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

          {canProceedDemo && (
            <div className="connect-count-hint" style={{ margin: '-0.25rem 0 0.25rem 0' }}>
              Scan method used: <strong>{scanMethod === 'heuristic' ? 'Heuristic (Rule-Based)' : 'AI LLM Scan'}</strong>
            </div>
          )}

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
          <p>Connect Gmail with OAuth, retrieve emails first, then run AI Scan to detect opportunities.</p>

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
              Gmail retrieval will fetch up to <strong>{emailCount}</strong> emails. You can run AI scan after previewing them.
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
              onClick={() => handleFetchGmailOpportunities('inbox')}
              disabled={!canRetrieveFromGmail || extracting}
            >
              <span>📊</span>
              {extractingMailbox === 'inbox' ? ' Retrieving emails...' : ' Inbox Emails to scan'}
            </button>
            <button
              className="connect-provider"
              onClick={() => handleFetchGmailOpportunities('spam')}
              disabled={!canRetrieveFromGmail || extracting}
            >
              <span>⚠️</span>
              {extractingMailbox === 'spam' ? ' Retrieving emails...' : ' Spam Emails to scan'}
            </button>
            <button
              className="connect-provider"
              onClick={() => handleFetchGmailOpportunities('both')}
              disabled={!canRetrieveFromGmail || extracting}
            >
              <span>🧩</span>
              {extractingMailbox === 'both' ? ' Retrieving emails...' : ' Inbox + Spam to scan'}
            </button>
          </div>

          {!gmailAuth?.connected && (
            <p className="connect-count-hint" style={{ marginTop: '0.25rem' }}>
              Connect Gmail first to enable Inbox, Spam, and Inbox + Spam retrieval.
            </p>
          )}

          <button className="btn-secondary" onClick={() => handleModeSelect('demo')} style={{ marginTop: '0.5rem' }}>
            → Use Demo Inbox
          </button>
        </div>
      )}
    </motion.div>
  );
}
