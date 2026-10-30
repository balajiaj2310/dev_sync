from django.contrib import admin
from .models import AIMentorConversation, AIMentorMessage


@admin.register(AIMentorConversation)
class AIMentorConversationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'repo', 'branch', 'created_at', 'updated_at')
    search_fields = ('title', 'user__username', 'repo')


@admin.register(AIMentorMessage)
class AIMentorMessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'role', 'created_at')
    search_fields = ('content', 'conversation__title')
