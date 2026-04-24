from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.db import connection


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def home(request):
    return Response(
        {
            "message": "API connected successfully.",
            "endpoints": {
                "classify_email": "/api/classify_email/",
                "oauth_start": "/api/gmail/oauth/start/",
                "oauth_callback": "/api/gmail/oauth/callback/",
                "extract": "/api/gmail/opportunities/extract/",
                "job_status": "/api/gmail/opportunities/jobs/<job_id>/",
            },
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def db_health(request):
    engine = settings.DATABASES.get("default", {}).get("ENGINE", "")

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()

        is_postgres = connection.vendor == "postgresql" or "postgresql" in engine.lower()

        return Response(
            {
                "status": "ok" if is_postgres else "degraded",
                "database": {
                    "vendor": connection.vendor,
                    "engine": engine,
                    "is_postgresql": is_postgres,
                },
            },
            status=status.HTTP_200_OK if is_postgres else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        return Response(
            {
                "status": "error",
                "database": {
                    "vendor": connection.vendor,
                    "engine": engine,
                    "is_postgresql": False,
                    "error": str(exc),
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
