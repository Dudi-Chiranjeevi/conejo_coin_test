from django.core.management.base import BaseCommand
from common.models import Role, Permission
import uuid

class Command(BaseCommand):
    help = 'Set up initial roles and permissions'

    def handle(self, *args, **options):
        # Create default roles
        roles = [
            {
                'id': uuid.UUID('00000000-0000-0000-0000-000000000001'),
                'name': 'Super Administrator',
                'description': 'Complete system control and configuration',
                'color': '#DC2626',
                'is_custom': False,
            },
            {
                'id': uuid.UUID('00000000-0000-0000-0000-000000000002'),
                'name': 'Administrator',
                'description': 'Full system access with user management',
                'color': '#2563EB',
                'is_custom': False,
            },
            {
                'id': uuid.UUID('00000000-0000-0000-0000-000000000003'),
                'name': 'Manager',
                'description': 'Department management and reporting access',
                'color': '#F59E0B',
                'is_custom': False,
            },
            {
                'id': uuid.UUID('00000000-0000-0000-0000-000000000004'),
                'name': 'User',
                'description': 'Standard inventory management access',
                'color': '#10B981',
                'is_custom': False,
            }
        ]
        
        for role_data in roles:
            role, created = Role.objects.update_or_create(
                id=role_data['id'],
                defaults={
                    'name': role_data['name'],
                    'description': role_data['description'],
                    'color': role_data['color'],
                    'is_custom': role_data['is_custom'],
                }
            )
            
            self.stdout.write(f"{'Created' if created else 'Updated'} role: {role.name}")
            
            # Define modules and actions
            modules = [choice[0] for choice in Permission.MODULE_CHOICES]
            actions = [choice[0] for choice in Permission.ACTION_CHOICES]
            
            # Create permissions for each role
            for module in modules:
                for action in actions:
                    # Determine if permission should be granted based on role
                    granted = False
                    
                    if str(role.id) == '00000000-0000-0000-0000-000000000001':
                        # Super admin has all permissions
                        granted = True
                    elif str(role.id) == '00000000-0000-0000-0000-000000000002':
                        # Admin has all permissions except role admin
                        granted = not (module == 'roles' and action == 'admin')
                    elif str(role.id) == '00000000-0000-0000-0000-000000000003':
                        # Manager has view and create/edit for most modules
                        granted = (
                            action == 'view' or 
                            (action in ['create', 'edit'] and module not in ['users', 'roles'])
                        )
                    elif str(role.id) == '00000000-0000-0000-0000-000000000004':
                        # User has view only for most modules
                        granted = (
                            action == 'view' and 
                            module not in ['users', 'roles', 'settings']
                        )
                    
                    Permission.objects.update_or_create(
                        role=role,
                        module=module,
                        action=action,
                        defaults={'granted': granted}
                    )
            
            self.stdout.write(f"Created permissions for role: {role.name}")
        
        self.stdout.write(self.style.SUCCESS('Successfully set up initial roles and permissions'))
