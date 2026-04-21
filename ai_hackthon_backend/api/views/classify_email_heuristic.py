from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import re

from api.services.gmail_extractors import (
    detect_type,
    extract_contact_info,
    extract_deadline,
    extract_eligibility,
    extract_required_documents,
    is_real_opportunity,
)


TYPE_SYNONYMS = {
    "scholarship": ["scholarship", "funding", "tuition", "stipend"],
    "internship": ["internship", "intern", "trainee"],
    "research_fellowship": ["research fellowship", "fellowship", "research grant"],
    "startup_program": ["startup program", "accelerator", "incubator", "pitch"],
    "competition": ["competition", "contest", "hackathon", "challenge"],
    "exchange_program": ["exchange program", "student exchange", "mobility"],
    "job": ["job", "hiring", "vacancy", "position"],
}

DISPLAY_BY_NORMALIZED = {
    "scholarship": "Scholarship",
    "internship": "Internship",
    "research_fellowship": "Research Fellowship",
    "startup_program": "Startup Program",
    "competition": "Competition",
    "exchange_program": "Exchange Program",
    "job": "Job",
    "grant": "Grant",
    "fellowship": "Research Fellowship",
    "accelerator": "Startup Program",
    "request_for_proposal": "Competition",
    "call_for_applications": "Competition",
    "general_opportunity": "General Opportunity",
}


def _normalize_key(value):
    value = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())
    return re.sub(r"_+", "_", value).strip("_")


def _normalize_preferred_type(value):
    normalized = _normalize_key(value)
    aliases = {
        "research_fellowship": "research_fellowship",
        "fellowship": "research_fellowship",
        "startup_program": "startup_program",
        "accelerator": "startup_program",
        "exchange_program": "exchange_program",
    }
    return aliases.get(normalized, normalized)


def _parse_skills(raw_skills):
    if isinstance(raw_skills, list):
        tokens = [str(item or "").strip().lower() for item in raw_skills]
    else:
        tokens = [token.strip().lower() for token in re.split(r",|\n|\|", str(raw_skills or ""))]

    # Keep meaningful skill terms only.
    return [token for token in tokens if len(token) >= 3]


def _detect_profile_aware_type(full_text, preferred_types, skills):
    lowered = full_text.lower()
    preferred = [_normalize_preferred_type(item) for item in (preferred_types or []) if str(item or "").strip()]

    for preferred_type in preferred:
        keywords = TYPE_SYNONYMS.get(preferred_type, [])
        if any(keyword in lowered for keyword in keywords):
            return preferred_type

    for skill in skills:
        if skill in lowered and preferred:
            return preferred[0]

    detected = _normalize_key(detect_type(full_text))
    if detected != "general_opportunity":
        return detected

    if preferred:
        return preferred[0]

    return detected


def _format_opportunity_type(opportunity_type):
    return " ".join(part.capitalize() for part in str(opportunity_type).split("_") if part)


@csrf_exempt
def classify_email_heuristic(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    subject = str(data.get("subject", "") or "")
    sender = str(data.get("from", "") or "")
    body = str(data.get("body", "") or "")
    preview = str(data.get("preview", "") or "")
    preferred_types = data.get("preferred_types", [])
    skills = _parse_skills(data.get("skills", ""))

    if not isinstance(preferred_types, list):
        preferred_types = []

    full_text = f"{subject}\n{preview}\n{body}".strip()
    is_opportunity = is_real_opportunity(subject, preview, body)

    detected_type = None
    if is_opportunity:
        normalized_type = _detect_profile_aware_type(full_text, preferred_types, skills)
        detected_type = DISPLAY_BY_NORMALIZED.get(
            normalized_type,
            _format_opportunity_type(normalized_type),
        )
    deadline = extract_deadline(full_text) or "Not specified"
    eligibility = extract_eligibility(full_text)
    required_docs = extract_required_documents(full_text)
    contact_info = extract_contact_info(full_text)
    contact_parts = []
    contact_parts.extend(contact_info.get("emails", []))
    contact_parts.extend(contact_info.get("phones", []))
    if sender:
        contact_parts.append(sender)
    contact = " | ".join(dict.fromkeys(part for part in contact_parts if part))

    reasoning = (
        "Heuristic rule-based classifier matched opportunity patterns in the email content."
        if is_opportunity
        else "Heuristic rule-based classifier did not find sufficient opportunity patterns."
    )

    return JsonResponse(
        {
            "isOpportunity": is_opportunity,
            "type": detected_type,
            "confidence": 70 if is_opportunity else 35,
            "extracted": {
                "deadline": deadline,
                "eligibility": eligibility,
                "requiredDocs": required_docs,
                "contact": contact,
                "applyLink": None,
            },
            "reasoning": reasoning,
        },
        safe=False,
    )
