import os
import secrets
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Connection, Profile, Skill, User
from .serializers import ProfileSerializer, PublicProfileSerializer


class UsersMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        # Handle user name updates
        name = request.data.get("name")
        if name:
            parts = str(name).strip().split(" ", 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ""
            user.save(update_fields=["first_name", "last_name"])

        # Reserved username check
        new_username = request.data.get("username")
        if new_username:
            new_username = str(new_username).strip().lower()
            if new_username in (
                "admin",
                "root",
                "api",
                "devsync",
                "system",
                "superuser",
            ):
                return Response(
                    {
                        "error": f"Username '{new_username}' is reserved.",
                        "code": "RESERVED_USERNAME",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(new_username) < 3:
                return Response(
                    {
                        "error": "Username must be at least 3 characters long.",
                        "code": "SHORT_USERNAME",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_username != user.username:
                if (
                    User.objects.filter(username__iexact=new_username)
                    .exclude(id=user.id)
                    .exists()
                ):
                    return Response(
                        {
                            "error": f"Username '{new_username}' is already taken.",
                            "code": "USERNAME_TAKEN",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.username = new_username
                user.save(update_fields=["username"])

        # Handle skills array
        skills_data = request.data.get("skills")
        if isinstance(skills_data, list):
            user.skills.all().delete()
            for s in skills_data:
                Skill.objects.create(user=user, name=str(s).strip())

        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


class PublicProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            return Response(
                {
                    "error": f"Developer @{username} not found.",
                    "code": "USER_NOT_FOUND",
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        profile, _ = Profile.objects.get_or_create(user=user)
        serializer = PublicProfileSerializer(profile)
        return Response(serializer.data)


class DevelopersListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicProfileSerializer

    def get_queryset(self):
        qs = Profile.objects.select_related("user").prefetch_related(
            "user__skills", "user__achievements"
        )
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(user__username__icontains=search)
        return qs


class PreferencesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}
        return Response(
            {
                "general": prefs.get(
                    "general",
                    {
                        "theme": "light",
                        "default_branch": "main",
                        "code_editor": "monaco",
                    },
                ),
                "notifications": prefs.get(
                    "notifications",
                    {
                        "email_digest": True,
                        "pull_requests": True,
                        "security_alerts": True,
                    },
                ),
                "visibility": prefs.get(
                    "visibility", {"profile_public": True, "show_email": False}
                ),
            }
        )

    def patch(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}
        for key in ("general", "notifications", "visibility"):
            if key in request.data:
                prefs[key] = {**prefs.get(key, {}), **request.data[key]}
        profile.preferences = prefs
        profile.save(update_fields=["preferences"])
        return Response({"success": True, "preferences": prefs})


class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get("avatar") or request.FILES.get("file")
        raw_b64 = request.data.get("data")

        if not file_obj and not raw_b64:
            return Response(
                {"error": "No avatar image provided.", "code": "MISSING_IMAGE"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if file_obj:
                img = Image.open(file_obj)
            else:
                import base64

                if ";base64," in raw_b64:
                    raw_b64 = raw_b64.split(";base64,")[1]
                img_data = base64.b64decode(raw_b64)
                img = Image.open(BytesIO(img_data))

            # Validate image format
            if img.format not in ("JPEG", "PNG", "WEBP"):
                return Response(
                    {
                        "error": "Unsupported image format. Allowed: PNG, JPEG, WEBP.",
                        "code": "INVALID_IMAGE",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Strip EXIF metadata by re-encoding clean RGB image
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(list(img.getdata()))
            output_io = BytesIO()
            clean_img.save(output_io, format="PNG")
            output_io.seek(0)

            # Generate random secure storage name
            random_name = f"avatar_{request.user.username}_{secrets.token_hex(6)}.png"
            profile, _ = Profile.objects.get_or_create(user=request.user)
            profile.avatar.save(random_name, ContentFile(output_io.read()), save=True)

            return Response(
                {
                    "success": True,
                    "avatar_url": profile.avatar.url,
                    "message": "Avatar uploaded and updated successfully.",
                }
            )
        except Exception as e:
            return Response(
                {
                    "error": f"Failed to process image: {str(e)}",
                    "code": "IMAGE_PROCESSING_ERROR",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
