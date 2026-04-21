from datetime import datetime
from api.services.gmail_auth_service import gmail_client_for_user
from api.services.gmail_extractors import (
    build_opportunity_record,
    is_real_opportunity,
    parse_message,
)


def extract_opportunities(user_key, email_count, query="", mailbox="inbox"):
    service, token_obj = gmail_client_for_user(user_key)

    list_kwargs = {
        "userId": "me",
        "maxResults": min(email_count, 500),
    }
    query_parts = []
    if mailbox == "spam":
        list_kwargs["includeSpamTrash"] = True
        query_parts.append("in:spam")
    elif mailbox == "inbox":
        query_parts.append("in:inbox")
    elif mailbox == "both":
        list_kwargs["includeSpamTrash"] = True
        query_parts.append("(in:inbox OR in:spam)")

    if query:
        query_parts.append(query)

    if query_parts:
        list_kwargs["q"] = " ".join(query_parts)

    list_resp = service.users().messages().list(**list_kwargs).execute()
    message_refs = list_resp.get("messages", [])

    opportunities = []
    fetched_emails = []
    scanned = 0

    for msg_ref in message_refs:
        raw = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="full",
        ).execute()
        parsed = parse_message(raw)
        scanned += 1

        fetched_emails.append(
            {
                "message_id": parsed["message_id"],
                "thread_id": parsed["thread_id"],
                "subject": parsed["subject"],
                "date": parsed["date"],
                "from": parsed["from"],
                "to": parsed["to"],
                "cc": parsed["cc"],
                "snippet": parsed["snippet"],
                "body": parsed["body"],
                "labels": parsed["labels"],
            }
        )

        thread = service.users().threads().get(
            userId="me",
            id=parsed["thread_id"],
            format="minimal",
        ).execute()
        thread_messages = thread.get("messages", [])
        thread_size = len(thread_messages)

        if is_real_opportunity(parsed["subject"], parsed["snippet"], parsed["body"]):
            position = 1
            for idx, thread_msg in enumerate(thread_messages, 1):
                if thread_msg.get("id") == parsed["message_id"]:
                    position = idx
                    break

            opportunities.append(
                build_opportunity_record(
                    parsed_message=parsed,
                    position_in_thread=position,
                    thread_size=thread_size,
                )
            )

    return {
        "meta": {
            "user_key": user_key,
            "gmail_address": token_obj.gmail_address,
            "email_count_requested": email_count,
            "gmail_query": " ".join(query_parts) if query_parts else query,
            "mailbox": mailbox,
            "messages_scanned": scanned,
            "opportunities_found": len(opportunities),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "schema_version": "1.0",
        },
        "emails": fetched_emails,
        "opportunities": opportunities,
    }
