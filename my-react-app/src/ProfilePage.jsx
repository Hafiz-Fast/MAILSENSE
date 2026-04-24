import { useState } from 'react';
import { motion } from 'framer-motion';
import './ProfilePage.css';

const OPPORTUNITY_TYPES = [
  'Scholarship', 'Internship', 'Research Fellowship',
  'Startup Program', 'Competition', 'Exchange Program', 'Job'
];

const DEGREES = ['BS', 'BE', 'MS', 'ME', 'MBA', 'PhD', 'Associate Degree', 'Other'];
const PROGRAMS = [
  'Computer Science', 'Software Engineering', 'Electrical Engineering',
  'Mechanical Engineering', 'Business Administration', 'Economics',
  'Mathematics', 'Physics', 'Biology', 'Other',
];

export default function ProfilePage({ onNext, onBack, onProfileSave }) {
  const [formStep, setFormStep] = useState(1);
  const [profile, setProfile] = useState({
    name: '',
    degree: '',
    program: '',
    semester: '',
    cgpa: '',
    skills: '',
    preferredTypes: [],
    financialNeed: false,
    locationPref: '',
    experience: '',
  });

  const [errors, setErrors] = useState({});

  const update = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleType = (type) => {
    setProfile(prev => ({
      ...prev,
      preferredTypes: prev.preferredTypes.includes(type)
        ? prev.preferredTypes.filter(t => t !== type)
        : [...prev.preferredTypes, type],
    }));
  };

  const validate = () => {
    const e = {};
    if (!profile.name.trim()) e.name = 'Name is required';
    if (!profile.degree) e.degree = 'Please select your degree';
    if (!profile.program) e.program = 'Please select your program';
    if (!profile.semester) e.semester = 'Semester is required';
    if (!profile.cgpa) e.cgpa = 'CGPA is required';
    const cgpaNum = parseFloat(profile.cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 4) e.cgpa = 'Enter a valid CGPA (0.0 – 4.0)';
    if (profile.preferredTypes.length === 0) e.preferredTypes = 'Select at least one preferred type';
    return e;
  };

  const validateStep = (stepNum) => {
    const allErrors = validate();
    const stepFields = {
      1: ['name', 'degree', 'program', 'semester', 'cgpa'],
      2: ['preferredTypes'],
      3: [],
    };
    const fieldsToCheck = stepFields[stepNum] || [];
    const nextErrors = fieldsToCheck.reduce((acc, field) => {
      if (allErrors[field]) {
        acc[field] = allErrors[field];
      }
      return acc;
    }, {});

    setErrors(prev => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const goToNextFormStep = () => {
    if (formStep < 3 && validateStep(formStep)) {
      setFormStep(prev => prev + 1);
    }
  };

  const goToPrevFormStep = () => {
    if (formStep > 1) {
      setFormStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    const e = validate();
    const hasErrors = Object.values(e).some(Boolean);
    if (hasErrors) {
      setErrors(e);
      if (e.name || e.degree || e.program || e.semester || e.cgpa) setFormStep(1);
      else if (e.preferredTypes) setFormStep(2);
      return;
    }
    onProfileSave(profile);
    onNext();
  };

  const stepDetails = [
    {
      title: 'Personal Information',
      desc: 'Academic profile and CGPA details for baseline matching.',
      active: formStep === 1,
    },
    {
      title: 'Skills & Interests',
      desc: 'Select opportunity preferences and your focus areas.',
      active: formStep === 2,
    },
    {
      title: 'Additional Details',
      desc: 'Optional signals to improve recommendation quality.',
      active: formStep === 3,
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      transition={{ duration: 0.4 }}
      className="profile-page-wrapper"
    >
      <div className="profile-split-layout">
        <aside className="profile-left-rail">
          <div className="profile-left-inner">
            <div className="profile-brand">
              <div className="profile-brand-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <span className="profile-eyebrow">MAILSENSE</span>
            </div>
            <h1>Student Profile Setup</h1>
            <p>
              Help the AI personalize opportunities for you. Keep your details accurate to get better matches.
            </p>

            <div className="profile-step-list" aria-label="Setup steps">
              {stepDetails.map((item, idx) => (
                <div
                  key={item.title}
                  className={`profile-step-item ${item.active ? 'active' : ''}`}
                >
                  <div className="profile-step-num">{idx + 1}</div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="profile-right-pane">
          <div className="page-header profile-page-header">
            <h1>🎓 Your Student Profile</h1>
            <p>All fields are used for matching. The more complete your profile, the better your recommendations.</p>
          </div>

          <div className="profile-form-grid">
            {/* Personal Info */}
            {formStep === 1 && (
            <div className="form-section">
              <div className="section-header">
                <span className="section-icon">👤</span>
                <div>
                  <h2>Personal Information</h2>
                  <p>Basic details for matching and addressing you</p>
                </div>
              </div>

              <div className="form-fields">
                <div className="form-field">
                  <label htmlFor="field-name">Full Name <span className="required">*</span></label>
                  <input id="field-name" type="text" placeholder="e.g. Abdullah Khan" value={profile.name} onChange={e => update('name', e.target.value)} className={errors.name ? 'error' : ''} />
                  {errors.name && <span className="err-msg">{errors.name}</span>}
                </div>

                <div className="form-row-2">
                  <div className="form-field">
                    <label htmlFor="field-degree">Degree <span className="required">*</span></label>
                    <select id="field-degree" value={profile.degree} onChange={e => update('degree', e.target.value)} className={errors.degree ? 'error' : ''}>
                      <option value="">Select degree…</option>
                      {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.degree && <span className="err-msg">{errors.degree}</span>}
                  </div>

                  <div className="form-field">
                    <label htmlFor="field-semester">Current Semester <span className="required">*</span></label>
                    <select id="field-semester" value={profile.semester} onChange={e => update('semester', e.target.value)} className={errors.semester ? 'error' : ''}>
                      <option value="">Select…</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                    {errors.semester && <span className="err-msg">{errors.semester}</span>}
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="field-program">Program / Major <span className="required">*</span></label>
                  <select id="field-program" value={profile.program} onChange={e => update('program', e.target.value)} className={errors.program ? 'error' : ''}>
                    <option value="">Select program…</option>
                    {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {errors.program && <span className="err-msg">{errors.program}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="field-cgpa">
                    CGPA <span className="required">*</span>
                    <span className="field-hint">out of 4.0</span>
                  </label>
                  <div className="cgpa-input-wrap">
                    <input
                      id="field-cgpa"
                      type="number" min="0" max="4" step="0.01"
                      placeholder="e.g. 3.45"
                      value={profile.cgpa}
                      onChange={e => update('cgpa', e.target.value)}
                      className={errors.cgpa ? 'error' : ''}
                    />
                    {profile.cgpa && !isNaN(parseFloat(profile.cgpa)) && (
                      <div className="cgpa-bar">
                        <div className="cgpa-fill" style={{ width: `${(parseFloat(profile.cgpa)/4)*100}%` }}></div>
                      </div>
                    )}
                  </div>
                  {errors.cgpa && <span className="err-msg">{errors.cgpa}</span>}
                </div>
              </div>
            </div>
            )}

            {/* Interests & Skills */}
            {formStep === 2 && (
            <div className="form-section">
              <div className="section-header">
                <span className="section-icon">💡</span>
                <div>
                  <h2>Skills & Interests</h2>
                  <p>Used to match opportunities to your background</p>
                </div>
              </div>

              <div className="form-fields">
                <div className="form-field">
                  <label htmlFor="field-skills">
                    Skills & Interests
                    <span className="field-hint">comma-separated</span>
                  </label>
                  <textarea
                    id="field-skills"
                    rows={3}
                    placeholder="e.g. Python, Machine Learning, React, Data Analysis, Public Speaking…"
                    value={profile.skills}
                    onChange={e => update('skills', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>
                    Preferred Opportunity Types <span className="required">*</span>
                    <span className="field-hint">select all that apply</span>
                  </label>
                  <div className="type-chips">
                    {OPPORTUNITY_TYPES.map(type => (
                      <button
                        key={type}
                        id={`type-chip-${type.replace(/\s+/g,'-').toLowerCase()}`}
                        className={`type-chip ${profile.preferredTypes.includes(type) ? 'selected' : ''}`}
                        onClick={() => toggleType(type)}
                        type="button"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {errors.preferredTypes && <span className="err-msg">{errors.preferredTypes}</span>}
                </div>
              </div>
            </div>
            )}

            {/* Additional */}
            {formStep === 3 && (
            <div className="form-section">
              <div className="section-header">
                <span className="section-icon">📋</span>
                <div>
                  <h2>Additional Details</h2>
                  <p>Optional but improves recommendation accuracy</p>
                </div>
              </div>

              <div className="form-fields">
                <div className="form-field financial-toggle-field">
                  <label>Financial Need</label>
                  <div className="toggle-row">
                    <button
                      id="btn-financial-yes"
                      className={`toggle-btn ${profile.financialNeed ? 'active' : ''}`}
                      onClick={() => update('financialNeed', true)}
                      type="button"
                    >✅ Yes, I need financial support</button>
                    <button
                      id="btn-financial-no"
                      className={`toggle-btn ${!profile.financialNeed ? 'active' : ''}`}
                      onClick={() => update('financialNeed', false)}
                      type="button"
                    >No</button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="field-location">Location Preference</label>
                  <input
                    id="field-location"
                    type="text"
                    placeholder="e.g. Lahore, Karachi, Remote, USA…"
                    value={profile.locationPref}
                    onChange={e => update('locationPref', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="field-experience">Past Experience</label>
                  <textarea
                    id="field-experience"
                    rows={3}
                    placeholder="Briefly describe any relevant past experience, projects, or achievements…"
                    value={profile.experience}
                    onChange={e => update('experience', e.target.value)}
                  />
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Actions */}
          <div className="profile-actions">
            {formStep > 1 ? (
              <button className="btn-secondary" id="btn-prev-section" onClick={goToPrevFormStep}>← Previous Section</button>
            ) : onBack ? (
              <button className="btn-secondary" id="btn-back-inbox" onClick={onBack}>← Back to Inbox</button>
            ) : <span />}

            {formStep < 3 ? (
              <button
                className="btn-primary"
                id="btn-next-section"
                onClick={goToNextFormStep}
              >
                Next Section →
              </button>
            ) : (
              <button
                className="btn-primary"
                id="btn-analyze"
                onClick={handleSubmit}
                style={!onBack ? { marginLeft: 'auto' } : {}}
              >
                Next: Scan Inbox 🔍
              </button>
            )}

          </div>

          <div className="profile-local-progress" aria-label="Profile step progress">
            {stepDetails.map((item, idx) => (
              <button
                key={item.title}
                type="button"
                className={`profile-progress-dot ${formStep === idx + 1 ? 'active' : ''}`}
                onClick={() => {
                  if (idx + 1 <= formStep || validateStep(formStep)) {
                    setFormStep(idx + 1);
                  }
                }}
                aria-label={`Go to section ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
