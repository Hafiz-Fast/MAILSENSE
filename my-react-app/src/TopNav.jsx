import './TopNav.css';

const steps = [
  { num: 1, label: 'My Profile' },
  { num: 2, label: 'Inbox Scan' },
  { num: 3, label: 'Results' },
];

export default function TopNav({ currentStep, onStepClick }) {
  return (
    <nav className="topnav">
      <div className="nav-brand">
        <div className="nav-logo" style={{ background: 'var(--primary)', color: 'var(--bg-color)', boxShadow: 'var(--shadow-glow)', border: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>
        <div className="nav-title-group">
          <span className="nav-company" style={{color: 'var(--primary)'}}>MailSense</span>
          <span className="nav-title">Choose What Matters</span>
        </div>
      </div>

      <div className="nav-steps">
        {steps.map((step, i) => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <button
              className={`nav-step ${currentStep === step.num ? 'active' : ''} ${currentStep > step.num ? 'completed' : ''}`}
              onClick={() => currentStep > step.num && onStepClick(step.num)}
            >
              <span className="step-num">
                {currentStep > step.num ? '✓' : step.num}
              </span>
              {step.label}
            </button>
            {i < steps.length - 1 && <span className="nav-step-sep">›</span>}
          </div>
        ))}
      </div>

      <div className="nav-badge" style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(209, 255, 39, 0.1)', color: 'var(--primary)', borderRadius: '99px', border: '1px solid rgba(209, 255, 39, 0.2)', fontSize: '14px', fontWeight: '500'}}>
        <span className="pulse-dot" style={{background: 'var(--primary)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block'}}></span>
        Now in private beta
      </div>
    </nav>
  );
}
