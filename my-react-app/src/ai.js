export const classifyEmail = async (email, apiKey) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/classify_email/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: email.subject,
        from: email.from,
        body: email.body
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Classification Error:", error);
    // Fallback response on error
    return {
      isOpportunity: false,
      type: null,
      confidence: 0,
      extracted: { deadline: 'Not specified', eligibility: [], requiredDocs: [], contact: '', applyLink: null },
      reasoning: `Error contacting backend AI proxy: ${error.message}`
    };
  }
};

export const classifyEmailHeuristic = async (email, profile = null) => {
  const preferredTypes = Array.isArray(profile?.preferredTypes) ? profile.preferredTypes : [];
  const skills = typeof profile?.skills === 'string' ? profile.skills : '';

  try {
    const response = await fetch('http://127.0.0.1:8000/api/classify_email/heuristic/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: email.subject,
        from: email.from,
        preview: email.preview,
        body: email.body,
        preferred_types: preferredTypes,
        skills,
      })
    });

    if (!response.ok) {
      throw new Error(`Heuristic API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Heuristic Classification Error:', error);
    return {
      isOpportunity: false,
      type: null,
      confidence: 0,
      extracted: { deadline: 'Not specified', eligibility: [], requiredDocs: [], contact: '', applyLink: null },
      reasoning: `Error contacting backend heuristic classifier: ${error.message}`
    };
  }
};
