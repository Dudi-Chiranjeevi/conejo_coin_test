from django.db import models
import uuid
from django.conf import settings
from django.db.models import F
 
class UserRoles(models.Model):
    """
    UserRoles table to store roles - only role definitions
    Only super admins can create new roles (enforced elsewhere).
    """
    role_name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    # Store Firebase user information (optional)
    created_by_uid = models.CharField(max_length=128, null=True, blank=True)
    created_by_email = models.CharField(max_length=255, null=True, blank=True)
    updated_by_uid = models.CharField(max_length=128, null=True, blank=True)
    updated_by_email = models.CharField(max_length=255, null=True, blank=True)
 
    class Meta:
        db_table = 'UserRoles'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
 
    def save(self, *args, **kwargs):
        # Normalize textual fields to lowercase
        if self.role_name:
            self.role_name = self.role_name.lower().strip()
        if self.description:
            self.description = self.description.lower().strip()
        super().save(*args, **kwargs)
 
    def __str__(self):
        return self.role_name
 
    @property
    def created_by_display(self):
        if self.created_by_email:
            return self.created_by_email
        elif self.created_by_uid:
            return f"User ({self.created_by_uid[:8]}...)"
        return "System"
 
    @property
    def updated_by_display(self):
        if self.updated_by_email:
            return self.updated_by_email
        elif self.updated_by_uid:
            return f"User ({self.updated_by_uid[:8]}...)"
        return "System"
 
    @property
    def permissions_summary(self):
        """Get permissions summary from module permissions"""
        permissions = set()
        for module_perm in self.module_permissions.all():
            if module_perm.can_view:
                permissions.add('View')
            if module_perm.can_create:
                permissions.add('Create')
            if module_perm.can_edit:
                permissions.add('Edit')
            if module_perm.can_delete:
                permissions.add('Delete')
        return ', '.join(sorted(permissions)) if permissions else 'No permissions'
 
 
class Module(models.Model):
    """
    Modules table to define different system modules - NOW WITH NUMERIC IDs
    """
    module_id = models.IntegerField(unique=True, primary_key=True)  # Numeric IDs only
    module_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'Modules'
        verbose_name = 'Module'
        verbose_name_plural = 'Modules'
 
    def save(self, *args, **kwargs):
        # ADDED: Convert all text fields to lowercase
        if self.module_name:
            self.module_name = self.module_name.lower().strip()
        if self.description:
            self.description = self.description.lower().strip()
        super().save(*args, **kwargs)
 
    def __str__(self):
        return self.module_name
 
 
class ModulePermission(models.Model):
    """
    Granular module-level permissions that define what each role can do
    This is the single source of truth for permissions
    """
    user_role = models.ForeignKey(UserRoles, on_delete=models.CASCADE, related_name='module_permissions')
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='permissions')
   
    # ADDED: module_name column for direct access
    module_name = models.CharField(max_length=100, blank=True, null=True)
   
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
   
    class Meta:
        db_table = 'ModulePermissions'
        unique_together = ('user_role', 'module')
        verbose_name = 'Module Permission'
        verbose_name_plural = 'Module Permissions'
   
    def save(self, *args, **kwargs):
        # AUTO-POPULATE: Set module_name from the related Module
        if self.module and not self.module_name:
            self.module_name = self.module.module_name
        elif self.module and self.module_name != self.module.module_name:
            # Keep in sync if module name changes
            self.module_name = self.module.module_name
           
        # ADDED: Convert module_name to lowercase
        if self.module_name:
            self.module_name = self.module_name.lower().strip()
           
        super().save(*args, **kwargs)
   
    def __str__(self):
        return f"{self.user_role.role_name} - {self.module.module_name}"
 
    @property
    def permissions_list(self):
        """Return list of granted permissions"""
        permissions = []
        if self.can_view:
            permissions.append('view')
        if self.can_create:
            permissions.append('create')
        if self.can_edit:
            permissions.append('edit')
        if self.can_delete:
            permissions.append('delete')
        return permissions
 
    @property
    def has_any_permission(self):
        """Check if any permission is granted"""
        return any([self.can_view, self.can_create, self.can_edit, self.can_delete])
 
 
# YOUR EXISTING MODELS BELOW
class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=20, default="#6B7280")
    is_custom = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    def save(self, *args, **kwargs):
        # ADDED: Convert to lowercase
        if self.name:
            self.name = self.name.lower().strip()
        if self.description:
            self.description = self.description.lower().strip()
        super().save(*args, **kwargs)
 
    def __str__(self):
        return self.name
 
class Permission(models.Model):
    # UPDATED: MODULE_CHOICES with numeric IDs
    MODULE_CHOICES = [
        (1, 'inventory'),  # CHANGED: lowercase
        (2, 'locations'),  # CHANGED: lowercase
        (3, 'ebay'),       # CHANGED: lowercase
        (4, 'reports'),    # CHANGED: lowercase
        (5, 'users'),      # CHANGED: lowercase
        (6, 'roles'),      # CHANGED: lowercase
        (7, 'settings'),   # CHANGED: lowercase
    ]
   
    ACTION_CHOICES = [
        ('view', 'view'),    # CHANGED: lowercase
        ('create', 'create'),# CHANGED: lowercase
        ('edit', 'edit'),    # CHANGED: lowercase
        ('delete', 'delete'),# CHANGED: lowercase
        ('admin', 'admin'),  # CHANGED: lowercase
    ]
   
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, related_name='permissions', on_delete=models.CASCADE)
    # CHANGED: module from CharField to IntegerField
    module = models.IntegerField(choices=MODULE_CHOICES)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    granted = models.BooleanField(default=False)
   
    class Meta:
        unique_together = ('role', 'module', 'action')
       
    def __str__(self):
        module_dict = dict(self.MODULE_CHOICES)
        module_name = module_dict.get(self.module, f"module {self.module}")  # CHANGED: lowercase
        return f"{self.role.name} - {module_name} - {self.action}"
 
 
# UPDATED: Utility function for initializing modules with numeric IDs
def initialize_modules():
    """Initialize all modules in the database with numeric IDs (run once)"""
    modules_data = [
        (1, 'inventory management', 'permissions for inventory management'),  # CHANGED: lowercase
        (2, 'location management', 'permissions for location management'),    # CHANGED: lowercase
        (3, 'ebay integration', 'permissions for ebay integration'),          # CHANGED: lowercase
        (4, 'reports & analytics', 'permissions for reports & analytics'),    # CHANGED: lowercase
        (5, 'user management', 'permissions for user management'),            # CHANGED: lowercase
        (6, 'role management', 'permissions for role management'),            # CHANGED: lowercase
        (7, 'system settings', 'permissions for system settings'),            # CHANGED: lowercase
    ]
 
    for module_id, module_name, description in modules_data:
        Module.objects.get_or_create(
            module_id=module_id,
            defaults={
                'module_name': module_name,
                'description': description
            }
        )
    print(f"Initialized {Module.objects.count()} modules with numeric IDs")
 
 
# NEW: Migration function to populate module_name in existing ModulePermission records
def populate_module_names():
    """Populate module_name in existing ModulePermission records"""
    from django.db import connection
   
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE ModulePermissions
            SET module_name = LOWER((
                SELECT module_name
                FROM Modules
                WHERE Modules.module_id = ModulePermissions.module_id
            ))
            WHERE module_name IS NULL OR module_name = ''
        """)
   
    print("Populated module_name in ModulePermissions table")