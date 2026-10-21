from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission allowing owners of an object to edit it.
    Assumes model instance has a `user` or `owner` attribute.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user_field = getattr(obj, 'user', getattr(obj, 'owner', None))
        return user_field == request.user

class IsStrictOwner(permissions.BasePermission):
    """
    Strict permission requiring authenticated user to be the owner of the object.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        user_field = getattr(obj, 'user', getattr(obj, 'owner', None))
        return user_field == request.user
