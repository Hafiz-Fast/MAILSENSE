from django.conf import settings

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
except ImportError:  # pragma: no cover
    Request = None
    Credentials = None
    Flow = None
    build = None

from api.models import GmailOAuthToken


SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_FILE = settings.BASE_DIR / "credentials.json"


def ensure_google_deps():
    if not all([Request, Credentials, Flow, build]):
        raise ImportError(
            "Missing Gmail dependencies. Install: "
            "google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client"
        )


def build_flow(redirect_uri, state=None):
    ensure_google_deps()
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        state=state,
    )
    flow.redirect_uri = redirect_uri
    return flow


def start_oauth(redirect_uri, state_token):
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            "credentials.json is missing in project root. Add OAuth desktop credentials first."
        )

    flow = build_flow(redirect_uri, state=state_token)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return {"auth_url": auth_url, "state": state}


def finish_oauth(code, state, redirect_uri):
    ensure_google_deps()
    flow = build_flow(redirect_uri, state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()

    return {
        "token_json": {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": creds.scopes,
        },
        "gmail_address": profile.get("emailAddress", ""),
    }


def save_token(user_key, token_json, gmail_address):
    token_obj, _ = GmailOAuthToken.objects.update_or_create(
        user_key=user_key,
        defaults={
            "token_json": token_json,
            "gmail_address": gmail_address,
        },
    )
    return token_obj


def credentials_from_db(token_obj):
    ensure_google_deps()
    stored_scopes = token_obj.token_json.get("scopes") if isinstance(token_obj.token_json, dict) else None
    # Prefer token's stored scopes to avoid strict scope-change failures with previously granted permissions.
    creds = Credentials.from_authorized_user_info(
        token_obj.token_json,
        scopes=stored_scopes or SCOPES,
    )
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_obj.token_json = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": creds.scopes,
        }
        token_obj.save(update_fields=["token_json", "updated_at"])
    return creds


def gmail_client_for_user(user_key):
    ensure_google_deps()
    token_obj = GmailOAuthToken.objects.filter(user_key=user_key).first()
    if not token_obj:
        raise ValueError("No Gmail OAuth token found for this user_key. Connect OAuth first.")

    creds = credentials_from_db(token_obj)
    service = build("gmail", "v1", credentials=creds)
    return service, token_obj
