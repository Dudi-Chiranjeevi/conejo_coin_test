import os
from pathlib import Path
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

def get_env(key, default=None, cast=str):
    """Use os.environ first, then fallback to decouple.config"""
    if key in os.environ:
        value = os.environ[key]
        if cast == bool:
            return value.lower() in ('true', 'yes', '1')
        return cast(value)
    if config:
        return config(key, default=default, cast=cast)
    return default

# Check if we're in build mode (no env vars needed during Docker build)
ENV = get_env('ENV', default='local')
IS_BUILD_MODE = os.getenv('BUILD_MODE', 'false').lower() == 'true'

# SECURITY WARNING: keep the secret key used in production secret!
DEBUG = get_env('DEBUG', default=True, cast=bool)
SECRET_KEY = get_env('SECRET_KEY', default='g0ykz=-x5gx1p)9k%xp^@#8(3!8a@v8u0&ci2nr#7n3_qzc7%i')
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS', 
    default='www.conejocoin.net,conejo-frontend-146447649143.us-central1.run.app', 
    cast=lambda v: [s.strip() for s in v.split(',')]
)

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework.authtoken',
    'django_filters',
    'corsheaders',
    "pgvector.django",
    'drf_spectacular',
    'drf_spectacular_sidecar',
    
    # Local apps
    'inventory',
    # 'categories',
    'locations',
    'common',
    'assistant',
    'ngc_integration',
    'ebay_integration',
    'client_management',
]

# eBay Configuration
EBAY_CONFIG = {
    'SANDBOX': {
        'app_id': config('EBAY_SANDBOX_APP_ID', default=''),
        'cert_id': config('EBAY_SANDBOX_CERT_ID', default=''),
        'dev_id': config('EBAY_SANDBOX_DEV_ID', default=''),
        'auth_token': config('EBAY_SANDBOX_AUTH_TOKEN', default=''),
        'base_url': config('EBAY_SANDBOX_BASE_URL', default='https://api.sandbox.ebay.com'),
        
        # 🆕 ADD THESE:
        'client_id': config('EBAY_SANDBOX_APP_ID', default=''),      # Same as app_id
        'client_secret': config('EBAY_SANDBOX_CERT_ID', default=''), # Same as cert_id
        'refresh_token': config('EBAY_SANDBOX_REFRESH_TOKEN', default=''),
        'ru_name': config('EBAY_SANDBOX_RU_NAME', default=''),
    },
    'PRODUCTION': {
        'app_id': config('EBAY_PROD_APP_ID', default=''),
        'cert_id': config('EBAY_PROD_CERT_ID', default=''),
        'dev_id': config('EBAY_PROD_DEV_ID', default=''),
        'auth_token': config('EBAY_PROD_AUTH_TOKEN', default=''),
        'base_url': config('EBAY_PROD_BASE_URL', default='https://api.ebay.com'),
        
        # 🆕 ADD THESE FOR PRODUCTION TOO:
        'client_id': config('EBAY_PROD_APP_ID', default=''),
        'client_secret': config('EBAY_PROD_CERT_ID', default=''),
        'refresh_token': config('EBAY_PROD_REFRESH_TOKEN', default=''),
        'ru_name': config('EBAY_PROD_RU_NAME', default=''),
    }
}



# Authentication backends
AUTHENTICATION_BACKENDS = [
    'common.auth.firebase_backend.FirebaseAuthenticationBackend',
    'django.contrib.auth.backends.ModelBackend',  # Keep for admin
]

_service_json = config("SERVICEACCOUNT_CREDENTIALS", default="")

SERVICEACCOUNT_CREDENTIALS = {}
if _service_json:
    try:
        SERVICEACCOUNT_CREDENTIALS = json.loads(_service_json)
    except Exception:
        # optional: log a warning, but DO NOT print the secret
        SERVICEACCOUNT_CREDENTIALS = {}

# Firebase configuration with build mode handling
if IS_BUILD_MODE:
    # Dummy values during Docker build
    FIREBASE_API_KEY = os.environ['FIREBASE_API_KEY']
    FIREBASE_AUTH_DOMAIN = os.environ['FIREBASE_AUTH_DOMAIN']
    FIREBASE_PROJECT_ID = os.environ['FIREBASE_PROJECT_ID']
    FIREBASE_STORAGE_BUCKET = os.environ['FIREBASE_STORAGE_BUCKET']
    FIREBASE_MESSAGING_SENDER_ID = os.environ['FIREBASE_MESSAGING_SENDER_ID']
    FIREBASE_APP_ID = os.environ['FIREBASE_APP_ID']
    FIREBASE_MEASUREMENT_ID = os.environ['FIREBASE_MEASUREMENT_ID'] 
else:
    # Runtime configuration with proper defaults
    FIREBASE_API_KEY = config('FIREBASE_API_KEY', default='')
    FIREBASE_AUTH_DOMAIN = config('FIREBASE_AUTH_DOMAIN', default='')
    FIREBASE_PROJECT_ID = config('FIREBASE_PROJECT_ID', default='')
    FIREBASE_STORAGE_BUCKET = config('FIREBASE_STORAGE_BUCKET', default='')
    FIREBASE_MESSAGING_SENDER_ID = config('FIREBASE_MESSAGING_SENDER_ID', default='')
    FIREBASE_APP_ID = config('FIREBASE_APP_ID', default='')
    FIREBASE_MEASUREMENT_ID = config('FIREBASE_MEASUREMENT_ID', default='')
    
    
    # Firebase API endpoints
    FIREBASE_AUTH_ENDPOINT = config('FIREBASE_AUTH_ENDPOINT', 
                                   default='https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')
    FIREBASE_TOKEN_ENDPOINT = config('FIREBASE_TOKEN_ENDPOINT',
                                    default='https://securetoken.googleapis.com/v1/token')
    FIREBASE_PUBLIC_KEYS_ENDPOINT = config('FIREBASE_PUBLIC_KEYS_ENDPOINT',
                                         default='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
    FIREBASE_TOKEN_ISSUER = config('FIREBASE_TOKEN_ISSUER',
                                  default='https://securetoken.google.com')

# Session configuration
SESSION_COOKIE_DOMAIN = config('SESSION_COOKIE_DOMAIN', default='.conejocoin.com')
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=True, cast=bool)
SESSION_COOKIE_HTTPONLY = config('SESSION_COOKIE_HTTPONLY', default=True, cast=bool)
SESSION_COOKIE_SAMESITE = config('SESSION_COOKIE_SAMESITE', default='Lax')
SESSION_COOKIE_AGE = config('SESSION_COOKIE_AGE', default=3600, cast=int)

NGC_BASE_URL = config('NGC_BASE_URL', default='https://dealer-api.collectiblesgroup.com')
NGC_USERNAME = config('NGC_USERNAME')
NGC_PASSWORD = config('NGC_PASSWORD')
NGC_COMPANY = config('NGC_COMPANY')


# NGC API paths
NGC_AUTH_PATH = config('NGC_AUTH_PATH', default='/auth/login')
NGC_BARCODE_PATH = config('NGC_BARCODE_PATH', default='/coins/certifications/v3/barcode')
NGC_LOOKUP_PATH = config('NGC_LOOKUP_PATH', default='/coins/certifications/v3/lookup')

# Google Cloud Storage configuration
GCS_BUCKET_NAME = config('GCS_BUCKET_NAME', default='your-bucket-name')
GCS_PUBLIC_URL = config('GCS_PUBLIC_URL', default='https://storage.googleapis.com')

MIDDLEWARE = [
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'common.middleware.firebase_middleware.FirebaseAuthMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

STATICFILES_FINDERS = [
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",  # this finds package static files
]


ROOT_URLCONF = 'settings.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'settings.wsgi.application'

# Database Configuration
if IS_BUILD_MODE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
else:
    DB_NAME = get_env('DB_NAME')
    DB_USER = get_env('DB_USER')
    DB_PASSWORD = get_env('DB_PASSWORD')
    DB_PORT = get_env('DB_PORT', default='5432')
    DB_USE_SSL = get_env('DB_USE_SSL', default=False, cast=bool)

    if ENV == 'prod':
        CLOUD_SQL_CONNECTION_NAME = get_env('CLOUD_SQL_CONNECTION_NAME')
        DB_HOST = f'/cloudsql/{CLOUD_SQL_CONNECTION_NAME}'
    else:
        DB_HOST = get_env('DB_HOST', default='localhost')

    db_options = {}
    if ENV == 'prod' or DB_USE_SSL:
        db_options['sslmode'] = 'require'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'OPTIONS': db_options,
            'TEST': {
                'NAME': 'test_inventory',
            }
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
] if (BASE_DIR / 'static').exists() else []

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'common.auth.firebase_auth.FirebaseDRFAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
    'DATE_FORMAT': '%Y-%m-%d',
}

# drf-spectacular settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Conejo Coin Inventory API',
    'DESCRIPTION': 'API for managing high-value collectibles inventory',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': True,  # Include schema in the UI
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
    'REDOC_DIST': 'SIDECAR',
    'APPEND_COMPONENTS': {},
    'COMPONENT_SPLIT_REQUEST': True,
    'COMPONENT_NO_READ_ONLY_REQUIRED': False,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,  # Enable deep linking for better navigation
        'persistAuthorization': True,  # Persist authorization data
        'displayOperationId': False,
        'defaultModelsExpandDepth': 1,
        'defaultModelExpandDepth': 1,
        'defaultModelRendering': 'model',
        'displayRequestDuration': True,
        'docExpansion': 'list',
        'filter': True,
        'showExtensions': True,
        'showCommonExtensions': True,
        'supportedSubmitMethods': ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'],
    },
}

# CORS Configuration
if DEBUG:
    # Development: Allow all origins
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOWED_ORIGINS = []
else:
    # Production: Restrict to specific origins
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = config(
        'CORS_ALLOWED_ORIGINS', 
        default='https://www.conejocoin.net',
        cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
    )

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'cache-control',
    'pragma',
]

# CSRF Configuration
if DEBUG:
    CSRF_TRUSTED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://www.conejocoin.net']
else:
    CSRF_TRUSTED_ORIGINS = config(
        'CSRF_TRUSTED_ORIGINS',
        default='https://www.conejocoin.net',
        cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
    )

# Security Settings for Production
if not DEBUG:
    # When behind a load balancer, we need to trust the X-Forwarded-Proto header
    # This prevents redirect loops when the load balancer terminates SSL
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # Only redirect to HTTPS if not already on HTTPS
    # The load balancer should handle this, so we can disable it in Django
    SECURE_SSL_REDIRECT = False
    
    # Other security settings
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'

# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'inventory': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'ngc_integration': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Cache Configuration (use in-memory for build, Redis for production)
if IS_BUILD_MODE:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
else:
    REDIS_URL = config('REDIS_URL', default=None)
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        } if REDIS_URL else {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

# Email Configuration (only for runtime)
# if not IS_BUILD_MODE:
#     EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
#     EMAIL_HOST = os.environ['EMAIL_HOST']
#     EMAIL_PORT = os.environ['EMAIL_PORT']
#     EMAIL_USE_TLS = os.environ['EMAIL_USE_TLS']
#     EMAIL_HOST_USER = os.environ['EMAIL_HOST_USER']
#     EMAIL_HOST_PASSWORD = os.environ['EMAIL_HOST_PASSWORD']
#     DEFAULT_FROM_EMAIL = os.environ['DEFAULT_FROM_EMAIL']