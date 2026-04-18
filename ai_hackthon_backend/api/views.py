# This file has been split into the views/ directory. Do not write code here.
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import requests