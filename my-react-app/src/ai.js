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
