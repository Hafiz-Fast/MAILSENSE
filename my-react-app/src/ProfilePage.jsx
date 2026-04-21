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

  const handleSubmit = () => {
    const e = validate();
    const hasErrors = Object.values(e).some(Boolean);
    if (hasErrors) { setErrors(e); return; }
    onProfileSave(profile);
    onNext();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      transition={{ duration: 0.4 }}
      className="page-wrapper"
    >
      <div className="page-header">
        <h1>🎓 Your Student Profile</h1>
        <p>Help the AI personalize which opportunities fit you best. All fields are used for matching — the more you fill in, the better.</p>
      </div>

      <div className="profile-form-grid">
        {/* Personal Info */}
        <div className="card form-section">
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

        {/* Interests & Skills */}
        <div className="card form-section">
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

        {/* Additional */}
        <div className="card form-section">
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
      </div>

      {/* Actions */}
      <div className="profile-actions">
        {onBack && (
          <button className="btn-secondary" id="btn-back-inbox" onClick={onBack}>← Back to Inbox</button>
        )}
        <button
          className="btn-primary"
          id="btn-analyze"
          onClick={handleSubmit}
          style={!onBack ? { marginLeft: 'auto' } : {}}
        >
          Next: Scan Inbox 🔍
        </button>
      </div>
    </motion.div>
  );
}
