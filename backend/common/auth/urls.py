from django.urls import path
from .views import (
    AuthStatusView, LoginView, LogoutView, TokenRefreshView, ForgotPasswordView,
    SignUpView, CheckVerificationView, ResendVerificationView,
    AllUsersView, CreateUserView, UpdateUserView, UpdateUserStatusView, DeleteUserView, EditUserProfileView
)
from .views_roles import (
    RoleListCreateView, RoleDetailView, RolePermissionsView, RoleUsersView
)
from common.views.user_roles_views import UserRolesListView, UserRolesDetailView, PermissionMatrixView
from common.views.secret_views import SecretsListView, SecretDetailView

urlpatterns = [
    # Authentication endpoints
    path('status/', AuthStatusView.as_view(), name='auth-status'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token-refresh/', TokenRefreshView.as_view(), name='auth-token-refresh'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    
    # User registration & verification
    path('signup/', SignUpView.as_view(), name='auth-signup'),
    path('check-verification/', CheckVerificationView.as_view(), name='auth-check-verification'),
    path('resend-verification/', ResendVerificationView.as_view(), name='auth-resend-verification'),
    
    # User management endpoints
    path('users/', CreateUserView.as_view(), name='auth-create-user'),
    path('users/all/', AllUsersView.as_view(), name='auth-all-users'),
    path('users/<str:uid>/', UpdateUserView.as_view(), name='auth-update-user'),
    path('users/<str:uid>/profile/', EditUserProfileView.as_view(), name='auth-edit-user-profile'),
    path('users/<str:uid>/status/', UpdateUserStatusView.as_view(), name='auth-update-user-status'),
    path('users/<str:uid>/delete/', DeleteUserView.as_view(), name='auth-delete-user'),
    
    # Role management
    path('roles/', RoleListCreateView.as_view(), name='auth-roles-list-create'),
    path('roles/<str:pk>/', RoleDetailView.as_view(), name='auth-role-detail'),
    path('roles/<str:pk>/permissions/', RolePermissionsView.as_view(), name='auth-role-permissions'),
    path('roles/<str:pk>/users/', RoleUsersView.as_view(), name='auth-role-users'),
    
    # UserRoles endpoints
    path('user-roles/', UserRolesListView.as_view(), name='auth-userroles-list-create'),
    path('user-roles/<int:pk>/', UserRolesDetailView.as_view(), name='auth-userroles-detail'),
    
    # Secret management
    path('secrets/', SecretsListView.as_view(), name='auth-secrets-list-create'),
    path('secrets/<str:secret_id>/', SecretDetailView.as_view(), name='auth-secret-detail'),
    
    # Permission matrix
    path('permission-matrix/', PermissionMatrixView.as_view(), name='permission-matrix'),
]