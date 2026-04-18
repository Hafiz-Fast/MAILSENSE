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
Analyze the following email and determine if it represents a REAL opportunity (Scholarship, Internship, Competition, Research Fellowship, Startup Program, etc.) that the student can apply for. 

IMPORTANT: Even if the deadline has passed or the program is closed, mark it as isOpportunity: true so the student can see the match. Ignore only spam, marketing, and account updates.

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
            # Use the latest available Gemini models
            models_to_try = [
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-3.1-flash",
                "gemini-3.1-flash-lite",
            ]
            last_error = ""

            for model_name in models_to_try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": { "temperature": 0.1 }
                }
                
                print(f"🔄 Trying model: {model_name}...")
                response = requests.post(gemini_url, json=payload)
                
                if response.status_code == 200:
                    print(f"✅ SUCCESS with {model_name}")
                    gemini_data = response.json()
                    result_text = gemini_data['candidates'][0]['content']['parts'][0]['text']
                    print(f"📄 Raw Response: {result_text}")
                    if result_text.startswith("```json"):
                        result_text = result_text.strip("`").replace("json\n", "", 1).strip()
                    parsed = json.loads(result_text)
                    print(f"✓ Parsed JSON: {parsed}")
                    return JsonResponse(parsed, safe=False)
                else:
                    print(f"⚠️ {model_name} failed with status {response.status_code}")
                    last_error = response.text

            return JsonResponse({"error": "All Gemini models failed", "details": last_error}, status=500)

        except Exception as e:
            print(f"❌ BACKEND EXCEPTION: {str(e)}")
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)
