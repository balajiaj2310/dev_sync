import os

env_settings = os.environ.get('DJANGO_SETTINGS_MODULE', 'devsync.settings.dev')
if 'prod' in env_settings:
    from .prod import *
else:
    from .dev import *
