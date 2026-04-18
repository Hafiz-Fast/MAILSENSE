from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import requests


@csrf_exempt
def classify_email(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email_subject = data.get('subject', '')
            email_from = data.get('from', '')
            email_body = data.get('body', '')

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
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}"

            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                }
            }

            response = requests.post(gemini_url, json=payload)
            if response.status_code == 200:
                gemini_data = response.json()
                result_text = gemini_data['candidates'][0]['content']['parts'][0]['text']
                # Gemini sometimes wraps JSON in markdown blocks like ```json ... ```
                if result_text.startswith("```json"):
                    result_text = result_text.strip("`").replace("json\n", "", 1).strip()
                return JsonResponse(json.loads(result_text), safe=False)
            else:
                print(f"❌ GEMINI API ERROR: {response.status_code} - {response.text}")
                return JsonResponse({"error": "Failed to connect to Gemini API", "details": response.text}, status=500)

        except Exception as e:
            print(f"❌ BACKEND EXCEPTION: {str(e)}")
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)
