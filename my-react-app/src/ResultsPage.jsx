import { useState, useEffect } from 'react';
import { analyzeOpportunities } from './data';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './ResultsPage.css';

const RANK_COLORS = ['#D1FF27', '#94a3b8', '#cd7f32'];
const RANK_LABELS = ['🥇 #1 Top Pick', '🥈 #2 Strong Match', '🥉 #3 Good Fit'];

const TYPE_ICONS = {
  'Scholarship': '🎓',
  'Internship': '💼',
  'Research Fellowship': '🔬',
  'Startup Program': '🚀',
  'Competition': '🏆',
  'Opportunity': '⭐',
};

const URGENCY_CONFIG = {
  high:   { label: 'Urgent', cls: 'badge-danger' },
  medium: { label: 'Soon',   cls: 'badge-warning' },
  low:    { label: 'Plenty of time', cls: 'badge-success' },
};

export default function ResultsPage({ emails, profile, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const analyzed = analyzeOpportunities(emails, profile);
      setResults(analyzed);
      setLoading(false);
      setExpanded(analyzed[0]?.id ?? null);
    }, 1800);
    return () => clearTimeout(timer);
  }, [emails, profile]);

  const scoreColor = (s) => {
    if (s >= 70) return '#10b981';
    if (s >= 45) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <SkeletonTheme baseColor="#1a211a" highlightColor="#273327">
        <motion.div 
          className="page-wrapper"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <div className="page-header">
            <Skeleton width="60%" height={40} style={{ marginBottom: '1rem' }} />
            <Skeleton width="80%" height={24} />
          </div>

          <div className="results-summary">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rs-item" style={{background: 'transparent', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px'}}>
                <Skeleton width="40%" height={32} style={{ marginBottom: '0.5rem' }} />
                <Skeleton width="70%" height={16} />
              </div>
            ))}
          </div>

          <div className="results-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="result-card">
                <div className="rc-header">
                  <div className="rc-header-left" style={{width: '100%'}}>
                    <Skeleton circle width={40} height={40} />
                    <div style={{ marginLeft: '1rem', width: '100%' }}>
                      <Skeleton width="30%" height={20} style={{ marginBottom: '0.5rem' }} />
                      <Skeleton width="80%" height={24} style={{ marginBottom: '0.5rem' }} />
                      <Skeleton width="50%" height={16} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </SkeletonTheme>
    );
  }

  return (
    <motion.div 
      className="page-wrapper"
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ duration: 0.4 }}
    >
      <div className="page-header">
        <h1>🎯 Your Opportunity Report</h1>
        <p>
          {profile?.name ? `${profile.name}, here` : 'Here'} are the {results.length} real opportunities from your inbox — ranked by how well they match your profile.
        </p>
      </div>

      {/* Summary Strip */}
      <div className="results-summary">
        <div className="rs-item">
          <span className="rs-num">{results.length}</span>
          <span className="rs-label">Opportunities Found</span>
        </div>
        <div className="rs-item rs-primary">
          <span className="rs-num">{results.filter(r => r.score >= 60).length}</span>
          <span className="rs-label">Strong Matches</span>
        </div>
        <div className="rs-item rs-warning">
          <span className="rs-num">{results.filter(r => r.extracted?.urgency === 'high').length}</span>
          <span className="rs-label">Urgent Deadlines</span>
        </div>
        <div className="rs-item rs-success">
          <span className="rs-num">{results[0]?.score ?? 0}</span>
          <span className="rs-label">Top Match Score</span>
        </div>
      </div>

      {/* Ranked Cards */}
      <div className="results-list">
        {results.map((result, idx) => {
          const isExpanded = expanded === result.id;
          const urgency = result.extracted?.urgency;
          const icon = TYPE_ICONS[result.extracted?.type] || '⭐';

          return (
            <div
              key={result.id}
              id={`result-card-${result.id}`}
              className={`result-card ${isExpanded ? 'expanded' : ''} ${idx < 3 ? `rank-${idx + 1}` : ''}`}
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              {/* Rank Banner */}
              {idx < 3 && (
                <div className="rank-banner" style={{ background: RANK_COLORS[idx] }}>
                  {RANK_LABELS[idx]}
                </div>
              )}

              {/* Card Header */}
              <div className="rc-header" onClick={() => setExpanded(isExpanded ? null : result.id)}>
                <div className="rc-header-left">
                  <div className="rc-icon">{icon}</div>
                  <div className="rc-title-group">
                    <div className="rc-type-row">
                      <span className={`badge ${
                        result.extracted?.type === 'Scholarship' ? 'badge-success' :
                        result.extracted?.type === 'Internship' ? 'badge-primary' :
                        result.extracted?.type === 'Research Fellowship' ? 'badge-accent' :
                        result.extracted?.type === 'Startup Program' ? 'badge-warning' :
                        result.extracted?.type === 'Competition' ? 'badge-danger' : 'badge-gray'
                      }`}>
                        {result.extracted?.type || 'Opportunity'}
                      </span>
                      {urgency && <span className={`badge ${URGENCY_CONFIG[urgency].cls}`}>{URGENCY_CONFIG[urgency].label}</span>}
                      {result.extracted?.daysLeft !== undefined && (
                        <span className={`badge ${result.extracted.daysLeft < 0 ? 'badge-danger' : 'badge-gray'}`}>
                          {result.extracted.daysLeft > 0 ? `${result.extracted.daysLeft} days left` : 
                           result.extracted.daysLeft === 0 ? 'Deadline is TODAY! ⚡' : 'EXPIRED'}
                        </span>
                      )}
                    </div>
                    <h3 className="rc-subject">{result.subject}</h3>
                    <div className="rc-from">📧 {result.from}</div>
                  </div>
                </div>

                <div className="rc-header-right">
                  <div className="score-ring">
                    <svg viewBox="0 0 64 64" className="score-svg">
                      <circle cx="32" cy="32" r="26" className="score-track" />
                      <circle
                        cx="32" cy="32" r="26"
                        className="score-fill"
                        style={{
                          stroke: scoreColor(result.score),
                          strokeDashoffset: `${163 - (163 * result.score / 100)}px`
                        }}
                      />
                    </svg>
                    <div className="score-text" style={{ color: scoreColor(result.score) }}>
                      {result.score}
                    </div>
                  </div>
                  <div className="rc-chevron">{isExpanded ? '▲' : '▼'}</div>
                </div>
              </div>

              {/* Why Pursue */}
              <div className="why-pursue">
                <span className="why-label">Why pursue this?</span>
                {result.reasons.slice(0, 2).map((r, i) => (
                  <span key={i} className="why-reason">✓ {r}</span>
                ))}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="rc-details">
                  <div className="details-grid">
                    <div className="detail-block">
                      <div className="detail-title">📅 Deadline</div>
                      <div className="detail-value">{result.extracted?.deadline || 'Not specified'}</div>
                    </div>
                    <div className="detail-block">
                      <div className="detail-title">📞 Contact / Apply</div>
                      <div className="detail-value">{result.extracted?.contact || result.from}</div>
                      {result.extracted?.applyLink && (
                        <a className="apply-link" href={`https://${result.extracted.applyLink.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">
                          🔗 Apply Now →
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="details-grid">
                    {result.extracted?.eligibility?.length > 0 && (
                      <div className="detail-block">
                        <div className="detail-title">✅ Eligibility</div>
                        <ul className="detail-list">
                          {result.extracted.eligibility.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.extracted?.requiredDocs?.length > 0 && (
                      <div className="detail-block">
                        <div className="detail-title">📄 Required Documents</div>
                        <ul className="detail-list">
                          {result.extracted.requiredDocs.map((doc, i) => (
                            <li key={i}>{doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {result.reasons.length > 0 && (
                    <div className="detail-block detail-full">
                      <div className="detail-title">🎯 Why This Matches Your Profile</div>
                      <div className="reasons-list">
                        {result.reasons.map((r, i) => (
                          <div key={i} className="reason-chip">
                            <span className="reason-check">✓</span> {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="email-body-section">
                    <div className="detail-title">📧 Original Email</div>
                    <pre className="email-body-text">{result.body}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="results-actions">
        <button className="btn-secondary" id="btn-back-profile" onClick={() => onBack(1)}>← Edit Profile</button>
        <button className="btn-primary" id="btn-start-over" onClick={() => onBack(2)}>
          🔄 Start Over with New Emails
        </button>
      </div>
    </motion.div>
  );
}
