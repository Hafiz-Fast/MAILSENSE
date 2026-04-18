import { useState } from 'react';
import TopNav from './TopNav';
import InboxPage from './InboxPage';
import ProfilePage from './ProfilePage';
import ResultsPage from './ResultsPage';
import './App.css';

export default function App() {
  const [step, setStep] = useState(1);
  const [emails, setEmails] = useState([]);
  const [profile, setProfile] = useState(null);

  const goTo = (s) => setStep(s);

  return (
    <div className="app">
      <TopNav currentStep={step} onStepClick={goTo} />

      {/* Step 1 — Profile first */}
      {step === 1 && (
        <ProfilePage
          onNext={() => goTo(2)}
          onBack={null}
          onProfileSave={(p) => setProfile(p)}
        />
      )}

      {/* Step 2 — Inbox scan */}
      {step === 2 && (
        <InboxPage
          onNext={() => goTo(3)}
          onBack={() => goTo(1)}
          onEmailsReady={(e) => setEmails(e)}
        />
      )}

      {/* Step 3 — Results */}
      {step === 3 && (
        <ResultsPage
          emails={emails}
          profile={profile}
          onBack={() => goTo(2)}
        />
      )}
    </div>
  );
}
