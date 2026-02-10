from rest_framework import serializers
from .models import Role, Permission, UserRoles, Module, ModulePermission
 
# Module Permission Serializers - UPDATED for numeric IDs
class ModulePermissionSerializer(serializers.ModelSerializer):
    module_name = serializers.CharField(source='module.module_name', read_only=True)
    # CHANGED: module_id from CharField to IntegerField
    module_id = serializers.IntegerField(source='module.module_id', read_only=True)
   
    class Meta:
        model = ModulePermission
        fields = [
            'id',
            'module_id',
            'module_name',
            'can_view',
            'can_create',
            'can_edit',
            'can_delete',
            'has_any_permission'
        ]
 
class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['module_id', 'module_name', 'description', 'is_active']
 
# UserRoles Serializers
class UserRolesSerializer(serializers.ModelSerializer):
    created_by_display = serializers.CharField(read_only=True)
    updated_by_display = serializers.CharField(read_only=True)
    permissions_summary = serializers.CharField(read_only=True)
    module_permissions = ModulePermissionSerializer(many=True, read_only=True)
   
    class Meta:
        model = UserRoles
        fields = [
            'id',
            'role_name',
            'description',
            'created_at',
            'updated_at',
            'created_by_uid',
            'created_by_email',
            'updated_by_uid',
            'updated_by_email',
            'created_by_display',
            'updated_by_display',
            'permissions_summary',
            'module_permissions'
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'created_by_uid',
            'created_by_email',
            'updated_by_uid',
            'updated_by_email',
            'created_by_display',
            'updated_by_display',
            'permissions_summary',
            'module_permissions'
        ]
 
class UserRolesCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRoles
        fields = [
            'role_name',
            'description'
        ]
   
    def validate_role_name(self, value):
        """
        Validate role name is unique (case-insensitive).
        Allow the same value for the instance being updated.
        """
        role_name = value.strip().lower()  # CHANGED: Convert to lowercase
        qs = UserRoles.objects.filter(role_name__iexact=role_name)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("User Role with this role name already exists.")
        return role_name
 
    def validate_description(self, value):
        """Convert description to lowercase"""
        if value:
            return value.strip().lower()
        return value
 
# Permission Matrix Serializer - UPDATED for numeric IDs
class PermissionMatrixUpdateSerializer(serializers.Serializer):
    permissions = serializers.JSONField(required=True)
   
    def validate(self, data):
        """
        Custom validation for the entire data structure - NOW EXPECTS NUMERIC MODULE IDs
        """
        permissions = data.get('permissions', {})
       
        if not isinstance(permissions, dict):
            raise serializers.ValidationError({
                'permissions': 'Permissions must be a dictionary'
            })
       
        # Valid numeric module IDs (1-7)
        valid_module_ids = [1, 2, 3, 4, 5, 6, 7]
       
        # Validate the structure
        for role_id, modules in permissions.items():
            if not isinstance(modules, dict):
                raise serializers.ValidationError({
                    'permissions': f'Modules for role {role_id} must be a dictionary'
                })
           
            for module_id, perms in modules.items():
                # Convert module_id to integer if it's a string
                try:
                    module_id_int = int(module_id)
                except (ValueError, TypeError):
                    raise serializers.ValidationError({
                        'permissions': f'Module ID {module_id} must be a numeric value (1-7)'
                    })
               
                # Validate module ID exists
                if module_id_int not in valid_module_ids:
                    raise serializers.ValidationError({
                        'permissions': f'Module ID {module_id} is not valid. Must be one of: {valid_module_ids}'
                    })
               
                if not isinstance(perms, dict):
                    raise serializers.ValidationError({
                        'permissions': f'Permissions for module {module_id} must be a dictionary'
                    })
               
                # Set default values for missing permissions and validate types
                expected_perms = ['can_view', 'can_create', 'can_edit', 'can_delete']
                for perm in expected_perms:
                    if perm not in perms:
                        perms[perm] = False
                    elif not isinstance(perms[perm], bool):
                        # Try to convert to boolean if it's not
                        try:
                            perms[perm] = bool(perms[perm])
                        except (ValueError, TypeError):
                            perms[perm] = False
       
        data['permissions'] = permissions
        return data
 
    def create(self, validated_data):
        """
        Handle bulk permission updates for the matrix
        Now works with numeric module IDs and includes module_name in lowercase
        """
        permissions_data = validated_data.get('permissions', {})
       
        for role_id, modules_data in permissions_data.items():
            try:
                user_role = UserRoles.objects.get(id=role_id)
               
                for module_id_str, perms_data in modules_data.items():
                    module_id = int(module_id_str)
                   
                    try:
                        module = Module.objects.get(module_id=module_id)
                       
                        # Get module_name from data or fallback to module name
                        module_name = perms_data.get('module_name') or module.module_name
                       
                        # ADDED: Convert to lowercase
                        module_name_lower = module_name.lower().strip()
                       
                        # Get or create the module permission
                        module_perm, created = ModulePermission.objects.get_or_create(
                            user_role=user_role,
                            module=module,
                            defaults={
                                **perms_data,
                                'module_name': module_name_lower  # CHANGED: Store in lowercase
                            }
                        )
                       
                        if not created:
                            # Update existing permission including module_name
                            for perm_field, value in perms_data.items():
                                setattr(module_perm, perm_field, value)
                            # Ensure module_name is always in sync and lowercase
                            module_perm.module_name = module_name_lower  # CHANGED: Store in lowercase
                            module_perm.save()
                           
                    except Module.DoesNotExist:
                        raise serializers.ValidationError({
                            'permissions': f'Module with ID {module_id} does not exist'
                        })
                   
            except UserRoles.DoesNotExist:
                raise serializers.ValidationError({
                    'permissions': f'User Role with ID {role_id} does not exist'
                })
       
        return validated_data
 
# NEW: Serializer for ModulePermission that includes the direct module_name field
class ModulePermissionCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating ModulePermission with direct module_name field
    """
    class Meta:
        model = ModulePermission
        fields = [
            'id',
            'user_role',
            'module',
            'module_name',  # ADDED: Direct module_name field
            'can_view',
            'can_create',
            'can_edit',
            'can_delete'
        ]
        read_only_fields = ['id']
 
    def validate(self, data):
        """
        Ensure module_name is set from the module if not provided and convert to lowercase
        """
        module = data.get('module')
        module_name = data.get('module_name')
       
        if module and not module_name:
            # Auto-populate module_name from module
            data['module_name'] = module.module_name
        elif module and module_name and module_name != module.module_name:
            # Keep module_name in sync with module
            data['module_name'] = module.module_name
       
        # ADDED: Convert module_name to lowercase
        if data.get('module_name'):
            data['module_name'] = data['module_name'].lower().strip()
           
        return data
 
# Legacy Role Serializers (updated for numeric module IDs)
class PermissionSerializer(serializers.ModelSerializer):
    # ADDED: module_name for display
    module_name = serializers.SerializerMethodField()
   
    class Meta:
        model = Permission
        fields = ['id', 'module', 'module_name', 'action', 'granted']
   
    def get_module_name(self, obj):
        """Get human-readable module name from choices"""
        module_dict = dict(Permission.MODULE_CHOICES)
        return module_dict.get(obj.module, f"module {obj.module}")  # CHANGED: lowercase
 
class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    user_count = serializers.SerializerMethodField()
   
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'color', 'is_custom', 'permissions', 'user_count', 'created_at', 'updated_at']
   
    def get_user_count(self, obj):
        # Get count from Firebase
        from common.services.firebase_service import firebase_service
        count = 0
        try:
            # Query Firestore for users with this role
            if firebase_service.firestore_client:
                users_ref = firebase_service.firestore_client.collection("users")
                query = users_ref.where("role", "==", str(obj.id))
                count = len(list(query.stream()))
        except Exception as e:
            print(f"Error counting users for role {obj.id}: {e}")
        return count
 
class RoleCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['name', 'description', 'color', 'is_custom']
   
    def validate_name(self, value):
        """Convert name to lowercase"""
        if value:
            return value.strip().lower()
        return value
   
    def validate_description(self, value):
        """Convert description to lowercase"""
        if value:
            return value.strip().lower()
        return value
 
class PermissionUpdateSerializer(serializers.Serializer):
    permissions = PermissionSerializer(many=True)
   
    def update(self, instance, validated_data):
        permissions_data = validated_data.get('permissions', [])
       
        # Clear existing permissions
        instance.permissions.all().delete()
       
        # Create new permissions
        for perm_data in permissions_data:
            Permission.objects.create(
                role=instance,
                module=perm_data['module'],
                action=perm_data['action'],
                granted=perm_data['granted']
            )
       
        return instance
 