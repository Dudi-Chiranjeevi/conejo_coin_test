from django.contrib import admin
from .models import UserRoles, Role, Permission
 
 
# ---------------------------
# UserRoles Admin
# ---------------------------
@admin.register(UserRoles)
class UserRolesAdmin(admin.ModelAdmin):
    list_display = (
        "role_name",
        "permissions_summary",
        "created_by_display",
        "updated_by_display",
        "created_at",
    )
    search_fields = ("role_name", "created_by_email", "updated_by_email")
    list_filter = ("created_at",)
    ordering = ("role_name",)
 
 
# ---------------------------
# Permission Inline for Role
# ---------------------------
class PermissionInline(admin.TabularInline):
    model = Permission
    extra = 0
    fields = ("module", "action", "granted")
    ordering = ("module", "action")
 
 
# ---------------------------
# Role Admin
# ---------------------------
@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_custom", "created_at", "updated_at")
    search_fields = ("name",)
    list_filter = ("is_custom", "created_at")
    ordering = ("name",)
 
    inlines = [PermissionInline]
 
 
# ---------------------------
# Permission Admin (standalone)
# ---------------------------
@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "module", "action", "granted")
    list_filter = ("module", "action", "granted")
    search_fields = ("role__name",)
    ordering = ("role", "module", "action")
 