from .base import *

DEBUG = True

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'devsync_dev.sqlite3',
    }
}

# If DATABASE_URL is set in environment, parse it
database_url = os.environ.get('DATABASE_URL')
if database_url:
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(database_url)
        DATABASES['default'] = {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed.path.lstrip('/'),
            'USER': parsed.username,
            'PASSWORD': parsed.password,
            'HOST': parsed.hostname,
            'PORT': parsed.port or 5432,
        }
    except Exception as e:
        print(f"Warning: Could not parse DATABASE_URL, using default SQLite: {e}")
