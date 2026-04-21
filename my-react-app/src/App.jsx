import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import TopNav from './TopNav';
import InboxPage from './InboxPage';
import ProfilePage from './ProfilePage';
import ResultsPage from './ResultsPage';
import './App.css';

const AnimatedBackground = () => {
  return (
    <div className="animated-bg">
      <motion.div
        className="bg-blob blob-1"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.1, 0.9, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="bg-blob blob-2"
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 30, -20, 0],
          scale: [1, 0.9, 1.1, 1]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="bg-blob blob-3"
        animate={{
          x: [0, 20, -30, 0],
          y: [0, 50, -10, 0],
          scale: [1, 1.2, 0.8, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const CALLBACK_GUARD_PREFIX = 'GMAIL_OAUTH_CALLBACK_PROCESSED';
const OPEN_CONNECT_INBOX_FLAG = 'OPEN_CONNECT_INBOX';

export default function App() {
  const [step, setStep] = useState(1);
  const [emails, setEmails] = useState([]);
  const [profile, setProfile] = useState(null);
  const [gmailAuth, setGmailAuth] = useState({
    connected: false,
    gmailAddress: '',
    busy: false,
    error: '',
  });

  const goTo = (s) => setStep(s);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const oauthMarker = params.get('gmail_oauth');

      if (!code || !state || oauthMarker !== '1') {
        return;
      }

      const callbackGuardKey = `${CALLBACK_GUARD_PREFIX}:${code}:${state}`;
      if (sessionStorage.getItem(callbackGuardKey) === '1') {
        setStep(2);
        sessionStorage.setItem(OPEN_CONNECT_INBOX_FLAG, '1');
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      sessionStorage.setItem(callbackGuardKey, '1');

      setStep(2);
      sessionStorage.setItem(OPEN_CONNECT_INBOX_FLAG, '1');
      setGmailAuth((prev) => ({ ...prev, busy: true, error: '' }));

      try {
        const callbackUrl = `${API_BASE}/api/gmail/oauth/callback/?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
        const response = await fetch(callbackUrl);
        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `OAuth callback failed with status ${response.status}`);
        }

        const gmailAddress = data.gmail_address || '';

        setGmailAuth({
          connected: true,
          gmailAddress,
          busy: false,
          error: '',
        });
      } catch (err) {
        setGmailAuth((prev) => ({
          ...prev,
          connected: false,
          busy: false,
          error: err?.message || 'Failed to complete Gmail OAuth callback.',
        }));
      } finally {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleOAuthCallback();
  }, []);

  return (
    <div className="app">
      <AnimatedBackground />
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
          gmailAuth={gmailAuth}
          setGmailAuth={setGmailAuth}
          profile={profile}
        />
      )}

      {/* Step 3 — Results */}
      {step === 3 && (
        <ResultsPage
          emails={emails}
          profile={profile}
          onBack={(stepNum = 2) => goTo(stepNum)}
        />
      )}
    </div>
  );
}
