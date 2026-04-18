import json

import requests
from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
def classify_email(request):
    try:
        email_subject = request.data.get("subject", "")
        email_from = request.data.get("from", "")
        email_body = request.data.get("body", "")

        prompt = f"""
You are an AI assistant helping a university student filter their inbox.
Analyze the following email and determine if it represents a REAL opportunity (Scholarship, Internship, Competition, Research Fellowship, Startup Program, etc.) that the student can apply for. Ignore spam, marketing, account updates, and automated application status emails.

Email Subject: {email_subject}
Email From: {email_from}
Email Body:
{email_body}

Extract the details and return ONLY a valid JSON object matching this schema:
{{
  "isOpportunity": true/false,
  "type": "string",
  "confidence": 0-100,
  "extracted": {{
    "deadline": "string or 'Not specified'",
    "eligibility": ["string"],
    "requiredDocs": ["string"],
    "contact": "string",
    "applyLink": "string or null"
  }},
  "reasoning": "string"
}}
"""

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return Response({"error": "GEMINI_API_KEY is not configured."}, status=500)

        gemini_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-flash:generateContent?key={api_key}"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        gemini_response = requests.post(gemini_url, json=payload, timeout=30)
        if gemini_response.status_code != 200:
            return Response(
                {
                    "error": "Failed to connect to Gemini API",
                    "details": gemini_response.text,
                },
                status=500,
            )

        gemini_data = gemini_response.json()
        result_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]
        return Response(json.loads(result_text))
    except Exception as exc:
        return Response({"error": str(exc)}, status=400)
