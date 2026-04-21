export const DEMO_EMAILS = [
  {
    id: 1,
    from: "support@netflix.com",
    subject: "Your subscription has been updated",
    preview: "We've updated your plan details...",
    time: "10:42 AM",
    body: "Hi! This is a confirmation that your Netflix subscription plan has been changed. No action is required.",
    isRead: true,
  },
  {
    id: 2,
    from: "events@microsoft.com",
    subject: "Final Call: Azure Workshop Registration",
    preview: "Registration closes in 3 days. Don't miss out...",
    time: "3 hours ago",
    body: "Hi! This is the final call for the Azure Cloud Workshop. Registration is free for all CS students. Deadline: April 21, 2026.",
    isRead: false,
  },
];

// Demo email IDs that represent opportunities before AI scan fallback.
export const OPPORTUNITY_IDS = [2, 4];

const parseDeadlineDate = (deadlineText) => {
  if (!deadlineText || deadlineText === 'Not specified') return null;

  const dateMatch = String(deadlineText).match(/(\w+\s+\d{1,2},?\s*\d{4})|(\d{1,2}\s+\w+\s+\d{4})/);
  const parsed = new Date(dateMatch ? dateMatch[0] : deadlineText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const WEIGHTS = {
  typeMatch: 0.25,
  cgpaEligibility: 0.20,
  skillsMatch: 0.20,
  urgencyDeadline: 0.20,
  financialFit: 0.15,
};

export const analyzeOpportunities = (emails, profile) => {
  // Only process emails that are opportunities
  const opportunities = emails.filter(e => e.aiData?.isOpportunity);

  const scored = opportunities.map(email => {
    let reasons = [];
    let extracted = {};
    let daysLeft = null;
    const factorScores = {
      typeMatch: 0,
      cgpaEligibility: 0,
      skillsMatch: 0,
      urgencyDeadline: 0,
      financialFit: 0,
    };

    const ai = email.aiData;
    const bodyText = (email.body || '').toLowerCase();

    // 1. Extract Data (AI or Fallback)
    if (ai) {
      extracted = { ...ai.extracted, type: ai.type };
      if (ai.reasoning) reasons.push(`AI Insight: ${ai.reasoning}`);
    } else {
      // Basic Fallback Regex if AI failed
      const deadlineMatch = bodyText.match(/deadline[:\s]+([^\n]+)/i);
      extracted.deadline = deadlineMatch ? deadlineMatch[1].trim() : 'Not specified';
      extracted.type = email.subject.toLowerCase().includes('scholarship') ? 'Scholarship' : 'Opportunity';
      extracted.contact = email.from;
    }

    // Deadline urgency should affect ranking even if profile is not provided.
    const deadlineDate = parseDeadlineDate(extracted.deadline);
    if (deadlineDate) {
      daysLeft = Math.ceil((deadlineDate - new Date()) / 86400000);
      extracted.daysLeft = daysLeft;

      if (daysLeft < 0) {
        factorScores.urgencyDeadline = 0;
        reasons.push('❌ Expired: This opportunity is no longer active.');
      } else if (daysLeft < 7) {
        extracted.urgency = 'high';
        factorScores.urgencyDeadline = 1;
        reasons.push('🔥 Urgent: Deadline is in less than a week!');
      } else if (daysLeft < 21) {
        extracted.urgency = 'medium';
        factorScores.urgencyDeadline = 0.7;
      } else {
        extracted.urgency = 'low';
        factorScores.urgencyDeadline = 0.4;
      }
    } else {
      // Partial credit if we cannot parse a date but still have a deadline string.
      factorScores.urgencyDeadline = extracted.deadline && extracted.deadline !== 'Not specified' ? 0.3 : 0;
    }

    // 2. Profile Matching Logic
    if (profile) {
      // --- Type Preference (+25) ---
      if (profile.preferredTypes?.includes(extracted.type)) {
        factorScores.typeMatch = 1;
        reasons.push(`🎯 Preferred: Matches your interest in ${extracted.type}s.`);
      } else if (extracted.type && extracted.type !== 'General Opportunity' && extracted.type !== 'Opportunity') {
        factorScores.typeMatch = 0.4;
      }

      // --- CGPA Eligibility ---
      // Prioritize AI-extracted criteria if available
      const requiredCgpaStr = ai?.extracted?.eligibility?.find(e => e.toLowerCase().includes('cgpa') || e.toLowerCase().includes('gpa'));
      const requiredCgpa = requiredCgpaStr ? parseFloat(requiredCgpaStr.match(/[0-9.]+/)[0]) :
        parseFloat((bodyText.match(/cgpa[^0-9]*([0-9.]+)/i) || [])[1]);

      const userCgpa = parseFloat(profile.cgpa);
      if (!isNaN(userCgpa) && !isNaN(requiredCgpa)) {
        if (userCgpa >= requiredCgpa) {
          factorScores.cgpaEligibility = 1;
          reasons.push(`✅ GPA Match: Your CGPA (${userCgpa}) meets the required ${requiredCgpa}.`);
        } else {
          factorScores.cgpaEligibility = 0;
          reasons.push(`⚠️ GPA Warning: This requires ${requiredCgpa} CGPA (you have ${userCgpa}).`);
        }
      } else if (isNaN(requiredCgpa)) {
        // Neutral if opportunity does not define CGPA.
        factorScores.cgpaEligibility = 0.5;
      }

      // --- Skills Matching ---
      if (profile.skills) {
        const userSkills = profile.skills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
        // Check both body and AI-extracted eligibility for skills
        const searchPool = (bodyText + ' ' + (ai?.extracted?.eligibility?.join(' ') || '')).toLowerCase();
        const matchedSkills = userSkills.filter(skill => searchPool.includes(skill));

        if (userSkills.length > 0) {
          factorScores.skillsMatch = clamp01(matchedSkills.length / Math.min(userSkills.length, 5));
        }

        if (matchedSkills.length > 0) {
          reasons.push(`🛠️ Skills Match: Found ${matchedSkills.slice(0, 3).join(', ')}.`);
        }
      }

      // --- Financial Fit ---
      if (profile.financialNeed && (extracted.type === 'Scholarship' || bodyText.includes('stipend') || bodyText.includes('paid'))) {
        factorScores.financialFit = 1;
        reasons.push('💰 Financial Support: Provides funding/stipend.');
      } else if (!profile.financialNeed) {
        // If user has no financial need, keep this factor neutral.
        factorScores.financialFit = 0.5;
      }
    } else {
      // No profile: give neutral values for profile-dependent factors.
      factorScores.typeMatch = extracted.type && extracted.type !== 'General Opportunity' && extracted.type !== 'Opportunity' ? 0.5 : 0.3;
      factorScores.cgpaEligibility = 0.5;
      factorScores.skillsMatch = 0.5;
      factorScores.financialFit = 0.5;
    }

    // If expired, override urgency/deadline factor to zero and cap overall score low.
    const isExpired = typeof daysLeft === 'number' && daysLeft < 0;

    const weighted01 =
      (factorScores.typeMatch * WEIGHTS.typeMatch) +
      (factorScores.cgpaEligibility * WEIGHTS.cgpaEligibility) +
      (factorScores.skillsMatch * WEIGHTS.skillsMatch) +
      (factorScores.urgencyDeadline * WEIGHTS.urgencyDeadline) +
      (factorScores.financialFit * WEIGHTS.financialFit);

    // finalScore = sum(factor * weight)
    let finalScore = Math.round(clamp01(weighted01) * 100);
    if (isExpired) finalScore = Math.min(finalScore, 20);

    return {
      ...email,
      score: finalScore,
      reasons: reasons.length > 0 ? reasons : ['Matches your student profile.'],
      extracted
    };
  });

  // Sort by weighted score first, then confidence to avoid arbitrary rank ties.
  return scored.sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;

    const confidenceDelta = (Number(b.aiData?.confidence || 0) - Number(a.aiData?.confidence || 0));
    if (confidenceDelta !== 0) return confidenceDelta;

    return String(a.subject || '').localeCompare(String(b.subject || ''));
  });
};
