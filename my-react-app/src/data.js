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

export const analyzeOpportunities = (emails, profile) => {
  // Only process emails that are opportunities
  const opportunities = emails.filter(e => e.aiData?.isOpportunity);

  const scored = opportunities.map(email => {
    let score = 50; // Base score
    let reasons = [];
    let extracted = {};

    const ai = email.aiData;
    const bodyText = (email.body || '').toLowerCase();

    // 1. Extract Data (AI or Fallback)
    if (ai) {
      extracted = { ...ai.extracted, type: ai.type };
      if (ai.reasoning) reasons.push(`AI Insight: ${ai.reasoning}`);

      // Use AI confidence to boost score
      if (ai.confidence > 85) score += 10;
    } else {
      // Basic Fallback Regex if AI failed
      const deadlineMatch = bodyText.match(/deadline[:\s]+([^\n]+)/i);
      extracted.deadline = deadlineMatch ? deadlineMatch[1].trim() : 'Not specified';
      extracted.type = email.subject.toLowerCase().includes('scholarship') ? 'Scholarship' : 'Opportunity';
      extracted.contact = email.from;
    }

    // 2. Profile Matching Logic
    if (profile) {
      // --- Type Preference (+25) ---
      if (profile.preferredTypes?.includes(extracted.type)) {
        score += 25;
        reasons.push(`🎯 Preferred: Matches your interest in ${extracted.type}s.`);
      }

      // --- CGPA Check (+20 or -40) ---
      // Prioritize AI-extracted criteria if available
      const requiredCgpaStr = ai?.extracted?.eligibility?.find(e => e.toLowerCase().includes('cgpa') || e.toLowerCase().includes('gpa'));
      const requiredCgpa = requiredCgpaStr ? parseFloat(requiredCgpaStr.match(/[0-9.]+/)[0]) :
        parseFloat((bodyText.match(/cgpa[^0-9]*([0-9.]+)/i) || [])[1]);

      const userCgpa = parseFloat(profile.cgpa);
      if (!isNaN(userCgpa) && !isNaN(requiredCgpa)) {
        if (userCgpa >= requiredCgpa) {
          score += 20;
          reasons.push(`✅ GPA Match: Your CGPA (${userCgpa}) meets the required ${requiredCgpa}.`);
        } else {
          score -= 40;
          reasons.push(`⚠️ GPA Warning: This requires ${requiredCgpa} CGPA (you have ${userCgpa}).`);
        }
      }

      // --- Skills Matching (+15 per skill) ---
      if (profile.skills) {
        const userSkills = profile.skills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
        // Check both body and AI-extracted eligibility for skills
        const searchPool = (bodyText + ' ' + (ai?.extracted?.eligibility?.join(' ') || '')).toLowerCase();
        const matchedSkills = userSkills.filter(skill => searchPool.includes(skill));

        if (matchedSkills.length > 0) {
          score += (matchedSkills.length * 15);
          reasons.push(`🛠️ Skills Match: Found ${matchedSkills.slice(0, 3).join(', ')}.`);
        }
      }

      // --- Financial Need (+20) ---
      if (profile.financialNeed && (extracted.type === 'Scholarship' || bodyText.includes('stipend') || bodyText.includes('paid'))) {
        score += 20;
        reasons.push('💰 Financial Support: Provides funding/stipend.');
      }

      // --- Deadline & Urgency ---
      if (extracted.deadline && extracted.deadline !== 'Not specified') {
        // Find any sequence that looks like a date (e.g. "May 20, 2025" or "20 May 2025")
        const dateMatch = extracted.deadline.match(/(\w+\s+\d{1,2},?\s*\d{4})|(\d{1,2}\s+\w+\s+\d{4})/);
        const deadlineDate = new Date(dateMatch ? dateMatch[0] : extracted.deadline);

        if (!isNaN(deadlineDate.getTime())) {
          const daysLeft = Math.ceil((deadlineDate - new Date()) / 86400000);
          extracted.daysLeft = daysLeft;

          if (daysLeft < 0) {
            score = 0; // Completely filter out if expired
            reasons.push('❌ Expired: This opportunity is no longer active.');
          } else {
            if (daysLeft < 7) {
              extracted.urgency = 'high';
              score += 15;
              reasons.push('🔥 Urgent: Deadline is in less than a week!');
            } else if (daysLeft < 21) {
              extracted.urgency = 'medium';
              score += 5;
            } else {
              extracted.urgency = 'low';
            }
          }
        }
      }
    }

    // Cap score at 100 and floor at 0
    const finalScore = Math.max(0, Math.min(100, score));

    return {
      ...email,
      score: finalScore,
      reasons: reasons.length > 0 ? reasons : ['Matches your student profile.'],
      extracted
    };
  });

  // Sort by score (highest first)
  return scored.sort((a, b) => b.score - a.score);
};
