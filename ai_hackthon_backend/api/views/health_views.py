from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


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
