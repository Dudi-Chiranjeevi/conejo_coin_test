export interface CreateUserRoleRequest {
  role_name: string;
  description: string;  // ADD THIS FIELD
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}