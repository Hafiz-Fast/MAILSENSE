from django.urls import path
from . import views

urlpatterns = [
    path('', views.home),
    path('gmail/oauth/start/', views.gmail_oauth_start),
    path('gmail/oauth/callback/', views.gmail_oauth_callback),
    path('gmail/opportunities/extract/', views.extract_gmail_opportunities),
    path('gmail/opportunities/jobs/<int:job_id>/', views.extraction_job_status),
    path('classify_email/', views.classify_email, name='classify_email'),
]
