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
        <div className="nav-logo">🎯</div>
        <div className="nav-title-group">
          <span className="nav-company">AI-Powered</span>
          <span className="nav-title">OpportunityAI</span>
        </div>
      </div>

      <div className="nav-steps">
        {steps.map((step, i) => (
          <>
            <button
              key={step.num}
              className={`nav-step ${currentStep === step.num ? 'active' : ''} ${currentStep > step.num ? 'completed' : ''}`}
              onClick={() => currentStep > step.num && onStepClick(step.num)}
            >
              <span className="step-num">
                {currentStep > step.num ? '✓' : step.num}
              </span>
              {step.label}
            </button>
            {i < steps.length - 1 && <span key={`sep-${i}`} className="nav-step-sep">›</span>}
          </>
        ))}
      </div>

      <div className="nav-badge">
        <span className="pulse-dot"></span>
        AI Ready
      </div>
    </nav>
  );
}
