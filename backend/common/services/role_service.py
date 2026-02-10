from common.models import Role, Permission
from common.services.firebase_service import firebase_service
import logging

logger = logging.getLogger(__name__)

class RoleService:
    def sync_role_to_firestore(self, role_id, role_data):
        """
        Sync a role from Django to Firestore
        """
        try:
            if not firebase_service.firestore_client:
                logger.error("Firestore client not initialized")
                return False

            # Update or create role document in Firestore
            role_ref = firebase_service.firestore_client.collection("roles").document(str(role_id))
            role_ref.set(role_data, merge=True)
            
            logger.info(f"Role {role_id} synced to Firestore")
            return True
        except Exception as e:
            logger.error(f"Error syncing role {role_id} to Firestore: {e}")
            return False
    
    def get_role_by_id(self, role_id):
        """
        Get a role by ID
        """
        try:
            return Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting role {role_id}: {e}")
            return None
    
    def get_all_roles(self):
        """
        Get all roles
        """
        try:
            return Role.objects.all()
        except Exception as e:
            logger.error(f"Error getting all roles: {e}")
            return []
    
    def create_role(self, role_data):
        """
        Create a new role
        """
        try:
            # Create role in Django
            role = Role.objects.create(**role_data)
            
            # Create default permissions
            modules = [choice[0] for choice in Permission.MODULE_CHOICES]
            actions = [choice[0] for choice in Permission.ACTION_CHOICES]
            
            for module in modules:
                for action in actions:
                    Permission.objects.create(
                        role=role,
                        module=module,
                        action=action,
                        granted=False
                    )
            
            # Sync to Firestore
            firestore_data = {
                'id': str(role.id),
                'name': role.name,
                'description': role.description,
                'color': role.color,
                'is_custom': role.is_custom,
                'created_at': role.created_at.isoformat() if role.created_at else None,
                'updated_at': role.updated_at.isoformat() if role.updated_at else None,
            }
            self.sync_role_to_firestore(role.id, firestore_data)
            
            return role
        except Exception as e:
            logger.error(f"Error creating role: {e}")
            return None
    
    def update_role(self, role_id, role_data):
        """
        Update a role
        """
        try:
            role = self.get_role_by_id(role_id)
            if not role:
                return None
            
            # Update role in Django
            for key, value in role_data.items():
                setattr(role, key, value)
            role.save()
            
            # Sync to Firestore
            firestore_data = {
                'id': str(role.id),
                'name': role.name,
                'description': role.description,
                'color': role.color,
                'is_custom': role.is_custom,
                'updated_at': role.updated_at.isoformat() if role.updated_at else None,
            }
            self.sync_role_to_firestore(role.id, firestore_data)
            
            return role
        except Exception as e:
            logger.error(f"Error updating role {role_id}: {e}")
            return None
    
    def delete_role(self, role_id):
        """
        Delete a role
        """
        try:
            role = self.get_role_by_id(role_id)
            if not role:
                return False
            
            # Delete role from Django
            role.delete()
            
            # Delete from Firestore
            if firebase_service.firestore_client:
                firebase_service.firestore_client.collection("roles").document(str(role_id)).delete()
            
            return True
        except Exception as e:
            logger.error(f"Error deleting role {role_id}: {e}")
            return False
    
    def update_role_permissions(self, role_id, permissions_data):
        """
        Update role permissions
        """
        try:
            role = self.get_role_by_id(role_id)
            if not role:
                return None
            
            # Delete existing permissions
            role.permissions.all().delete()
            
            # Create new permissions
            for perm_data in permissions_data:
                Permission.objects.create(
                    role=role,
                    module=perm_data['module'],
                    action=perm_data['action'],
                    granted=perm_data['granted']
                )
            
            # Sync to Firestore
            firestore_data = {
                'id': str(role.id),
                'name': role.name,
                'description': role.description,
                'color': role.color,
                'is_custom': role.is_custom,
                'updated_at': role.updated_at.isoformat() if role.updated_at else None,
                'permissions': [
                    {
                        'module': p.module,
                        'action': p.action,
                        'granted': p.granted
                    } for p in role.permissions.all()
                ]
            }
            self.sync_role_to_firestore(role.id, firestore_data)
            
            return role
        except Exception as e:
            logger.error(f"Error updating permissions for role {role_id}: {e}")
            return None

# Singleton instance
role_service = RoleService()
