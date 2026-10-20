from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Standardize all API error responses into the consistent envelope:
    {
        "error": "Human readable error summary",
        "code": "ERROR_CODE",
        "details": {...} or [...]
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data
        error_msg = "An error occurred."
        error_code = "API_ERROR"

        if isinstance(data, dict):
            if 'detail' in data:
                error_msg = str(data['detail'])
                error_code = getattr(exc, 'default_code', 'ERROR').upper()
            elif 'error' in data:
                error_msg = str(data['error'])
                error_code = data.get('code', 'ERROR')
            else:
                # First field error
                first_key = next(iter(data))
                val = data[first_key]
                if isinstance(val, list) and len(val) > 0:
                    error_msg = f"{first_key}: {val[0]}"
                else:
                    error_msg = f"{first_key}: {val}"
                error_code = "VALIDATION_ERROR"
        elif isinstance(data, list) and len(data) > 0:
            error_msg = str(data[0])
            error_code = "VALIDATION_ERROR"

        response.data = {
            "error": error_msg,
            "code": error_code,
            "details": data
        }

    return response
