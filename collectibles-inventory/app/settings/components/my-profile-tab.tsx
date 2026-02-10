"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  //User,
  Shield,
  Palette,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Upload,
  Loader2,
  RotateCcw, // Added for reset password icon
  Edit,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useToast } from "@/components/ui/use-toast";

const API_BASE_URL = process.env.BASE_API_URL || "https://www.conejocoin.net";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { UserSession } from "../types/user-management";
import type { User } from "../../auth/types/auth";
import { ForgotPasswordModal } from "../../auth/components/forgot-password-modal"; // Import the modal

interface MyProfileTabProps {
  onChangesDetected: (hasChanges: boolean) => void;
  user: User | null; // Allow user to be null
}

export function MyProfileTab({ onChangesDetected, user }: MyProfileTabProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false); // State for reset password modal

  // Show loading state
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    //bio: "",
    description: "",
    avatar: "/placeholder.svg?height=100&width=100",
    department: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
    },
  });

  // Store original data for cancel operation
  const [originalProfileData, setOriginalProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    description: "",
    avatar: "/placeholder.svg?height=100&width=100",
    department: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
    },
  });

  //added by uday
  useEffect(() => {
    if (!user) return;

    const isChanged =
      user.firstName !== profileData.firstName ||
      user.lastName !== profileData.lastName ||
      user.email !== profileData.email ||
      user.phone !== profileData.phone ||
      user.description !== profileData.description;

    setHasChanges(isChanged);
    onChangesDetected(isChanged);
  }, [user, profileData, onChangesDetected]);

  const [securitySettings, setSecuritySettings] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: true,
    loginAlerts: true,
    sessionTimeout: 30,
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [preferences, setPreferences] = useState({
    theme: "light",
    language: "en",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    emailNotifications: true,
    pushNotifications: false,
    digestFrequency: "daily",
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Mock active sessions
  const [activeSessions] = useState<UserSession[]>([
    {
      id: "1",
      deviceInfo: "Chrome on Windows 11",
      location: "New York, NY",
      lastActivity: "2024-01-15T10:30:00Z",
      isCurrentSession: true,
    },
    {
      id: "2",
      deviceInfo: "Safari on iPhone 15",
      location: "New York, NY",
      lastActivity: "2024-01-15T08:15:00Z",
      isCurrentSession: false,
    },
    {
      id: "3",
      deviceInfo: "Firefox on MacBook Pro",
      location: "New York, NY",
      lastActivity: "2024-01-14T16:45:00Z",
      isCurrentSession: false,
    },
  ]);

  // Initialize profile data when user is available
  useEffect(() => {
    if (user) {
      console.log("[PROFILE] User data received:", user);

      // Only use values from the API, no fallbacks for critical fields
      const newProfileData = {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "", // Non-critical field can keep default
        description: user.description || "", // Non-critical field
        avatar: "/placeholder.svg?height=100&width=100", // Non-critical field
        department: "Management", // Non-critical field
        emergencyContact: {
          name:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            "Emergency Contact",
          phone: "+1 (555) 987-6543",
          relationship: "Contact",
        }, // Non-critical field
      };

      setProfileData(newProfileData);
      setOriginalProfileData(newProfileData);
      console.log("[PROFILE] Profile data initialized with user values:", {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      });
      setIsLoading(false);
    }
  }, [user]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - revert to original values
      setProfileData(originalProfileData);
      setIsEditing(false);
      setHasChanges(false);
      onChangesDetected(false);
    } else {
      // Start editing
      setIsEditing(true);
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileData((prev) => ({ ...prev, avatar: result }));
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const levels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
    const colors = [
      "bg-red-400",
      "bg-rose-300",
      "bg-goldYellow/60",
      "bg-sky-400",
      "bg-emerald-400",
    ];

    return {
      level: levels[strength] || "Very Weak",
      color: colors[strength] || "bg-red-500",
      percentage: (strength / 5) * 100,
    };
  };

  const passwordStrength = getPasswordStrength(securitySettings.newPassword);

  const formatLastActivity = (lastActivity: string) => {
    const date = new Date(lastActivity);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Active now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return date.toLocaleDateString();
  };

  // Update the user profile - temporarily disabled
  //commented by uday
  // const updateUserProfile = async (userId: string, data: any) => {
  //   try {
  //     // Temporarily disabled for maintenance
  //     throw new Error(
  //       "Profile updates are temporarily disabled while we improve our services."
  //     );

  //     // Original code (commented out):
  //     /*
  //     const response = await axios.patch(
  //       `${API_BASE_URL}/api/v1/auth/users/${userId}/`,
  //       data,
  //       {
  //         withCredentials: true,
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //       }
  //     );
  //     return response.data;
  //     */
  //   } catch (error) {
  //     console.error("Error updating user profile:", error);
  //     throw error;
  //   }
  // };

  //Added by uday edit user functionality
  const updateUserProfile = async (userId: string, data: any) => {
    try {
      console.log("[DEBUG] Starting user profile update...");
      console.log("[DEBUG] User ID:", userId);
      console.log("[DEBUG] Payload:", data);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/users/${userId}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );

      console.log("[DEBUG] Response Status:", response.status);
      console.log("[DEBUG] Response Headers:", response.headers);

      const result = await response.json();

      console.log("[DEBUG] Response Body:", result);

      if (!response.ok) {
        throw new Error(
          result.error || result.detail || "Failed to update profile",
        );
      }

      return result;
    } catch (error) {
      console.error("[DEBUG] API error updating user profile:", error);
      throw error;
    }
  };

  const handleChangePassword = async () => {
    if (!user?.id) return;

    // Validate new password matches confirmation
    if (securitySettings.newPassword !== securitySettings.confirmPassword) {
      toast({
        title: "Error",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    // Validate password strength
    const strength = getPasswordStrength(securitySettings.newPassword);
    if (strength.percentage < 60) {
      toast({
        title: "Password too weak",
        description: "Please choose a stronger password.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdatingPassword(true);

      await axios.post(
        `${API_BASE_URL}/api/v1/auth/password/change/`,
        {
          old_password: securitySettings.currentPassword,
          new_password1: securitySettings.newPassword,
          new_password2: securitySettings.confirmPassword,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      toast({
        title: "Success",
        description: "Password updated successfully!",
        variant: "default",
      });

      // Clear password fields
      setSecuritySettings((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error: any) {
      console.error("Error changing password:", error);

      let errorMessage = "Failed to update password. Please try again.";
      if (error.response?.data) {
        // Handle specific error messages from the API
        const data = error.response.data;
        if (data.old_password) {
          errorMessage = `Current password: ${data.old_password.join(" ")}`;
        } else if (data.new_password2) {
          errorMessage = `New password: ${data.new_password2.join(" ")}`;
        } else if (data.non_field_errors) {
          errorMessage = data.non_field_errors.join(" ");
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSave = async () => {
    console.log("[DEBUG] handleSave called");

    if (!user?.id) {
      console.warn("[DEBUG] No user id available");
      toast({
        title: "Error",
        description: "No user information available. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!profileData.firstName || !profileData.lastName || !profileData.email) {
      toast({
        title: "Error",
        description:
          "Please fill in all required fields (First Name, Last Name, Email).",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      const updateData = {
        firstname: profileData.firstName,
        lastname: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        description: profileData.description,
        // Add more fields if necessary
      };

      console.log("[DEBUG] Calling updateUserProfile with:", updateData);

      const result = await updateUserProfile(user.id, updateData);

      console.log("[DEBUG] updateUserProfile result:", result);

      const isChangingPassword =
        securitySettings.currentPassword &&
        securitySettings.newPassword &&
        securitySettings.confirmPassword;

      if (isChangingPassword) {
        if (securitySettings.newPassword !== securitySettings.confirmPassword) {
          throw new Error("New password and confirmation do not match.");
        }

        const strength = getPasswordStrength(securitySettings.newPassword);
        if (strength.percentage < 60) {
          throw new Error(
            "Password too weak. Please choose a stronger password.",
          );
        }

        await axios.post(
          `${API_BASE_URL}/api/v1/auth/password/change/`,
          {
            old_password: securitySettings.currentPassword,
            new_password1: securitySettings.newPassword,
            new_password2: securitySettings.confirmPassword,
          },
          {
            withCredentials: true,
            headers: { "Content-Type": "application/json" },
          },
        );

        setSecuritySettings((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      }

      toast({
        title: "Success",
        description: isChangingPassword
          ? "Profile and password updated successfully!"
          : "Profile updated successfully!",
        variant: "default",
      });

      // Update original data and exit edit mode
      setOriginalProfileData(profileData);
      setIsEditing(false);
      setHasChanges(false);
      onChangesDetected(false);
    } catch (error: any) {
      console.error("[DEBUG] Error in handleSave:", error);

      let errorMessage = "Failed to update profile. Please try again.";

      if (error.response?.data) {
        const data = error.response.data;
        errorMessage =
          data.detail ||
          Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error updating profile",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Reset Password Button */}
      {/* commented by uday
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setResetPasswordModalOpen(true)}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Password
        </Button>
      </div> */}

      {/* Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          {/* <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle> */}
          <CardTitle>Personal Information</CardTitle>
          <div className="flex items-center gap-2">
            {isEditing && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                Editing Mode
              </Badge>
            )}
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEditToggle}
                className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={profileData.avatar || "/placeholder.svg"}
                  alt="Profile"
                />
                <AvatarFallback className="text-lg">
                  {profileData.firstName.charAt(0)}
                  {profileData.lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                  <Upload className="h-3 w-3" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {!isEditing && (
              <div className="text-sm text-gray-500">
                <p>Click the edit button to change your profile picture</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => {
                  setProfileData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => {
                  setProfileData((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => {
                  setProfileData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profileData.phone}
                onChange={(e) => {
                  setProfileData((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio / Description</Label>
            <Textarea
              id="bio"
              value={profileData.description}
              onChange={(e) => {
                setProfileData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }));
                setHasChanges(true);
              }}
              rows={3}
              placeholder="Tell us about yourself..."
              disabled={!isEditing}
            />
          </div>

          {/* Emergency Contact */}
          {/* <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Emergency Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={profileData.emergencyContact.name}
                  onChange={(e) => {
                    setProfileData((prev) => ({
                      ...prev,
                      emergencyContact: {
                        ...prev.emergencyContact,
                        name: e.target.value,
                      },
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={profileData.emergencyContact.phone}
                  onChange={(e) => {
                    setProfileData((prev) => ({
                      ...prev,
                      emergencyContact: {
                        ...prev.emergencyContact,
                        phone: e.target.value,
                      },
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input
                  value={profileData.emergencyContact.relationship}
                  onChange={(e) => {
                    setProfileData((prev) => ({
                      ...prev,
                      emergencyContact: {
                        ...prev.emergencyContact,
                        relationship: e.target.value,
                      },
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>
            </div>
          </div> */}
        </CardContent>
      </Card>

      {/* Security Settings - Temporarily Disabled */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reset Password Section */}
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">Password Reset</h4>
              <p className="text-sm text-gray-600">
                Reset your password using email verification
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setResetPasswordModalOpen(true)}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Password
            </Button>
          </div>
          {/* commented by uday
          <div className="space-y-4 opacity-50" aria-disabled="true">
            <h4 className="font-medium text-gray-900">Change Password</h4>
            <p className="text-sm text-gray-500">
              This feature is temporarily unavailable while we make improvements to our security systems.
            </p>
          </div> */}
        </CardContent>
      </Card>

      {/* Session Management - Also temporarily disabled
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Session management is currently unavailable.
          </p>
        </CardContent>
      </Card>
      */}

      {/* Removed all security-related form elements and JSX that was causing structure issues */}

      {/* End of Security Settings Section */}
      {/*
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword.current ? "text" : "password"}
                    value={securitySettings.currentPassword}
                    onChange={(e) => {
                      setSecuritySettings((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }));
                      onChangesDetected(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() =>
                      setShowPassword((prev) => ({
                        ...prev,
                        current: !prev.current,
                      }))
                    }
                  >
                    {showPassword.current ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword.new ? "text" : "password"}
                    value={securitySettings.newPassword}
                    onChange={(e) => {
                      setSecuritySettings((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }));
                      onChangesDetected(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, new: !prev.new }))
                    }
                  >
                    {showPassword.new ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {securitySettings.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {passwordStrength.level}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPassword.confirm ? "text" : "password"}
                    value={securitySettings.confirmPassword}
                    onChange={(e) => {
                      setSecuritySettings((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }));
                      onChangesDetected(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() =>
                      setShowPassword((prev) => ({
                        ...prev,
                        confirm: !prev.confirm,
                      }))
                    }
                  >
                    {showPassword.confirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {securitySettings.confirmPassword &&
                  securitySettings.newPassword !==
                    securitySettings.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">
                      Passwords do not match
                    </p>
                  )}
              </div>
            </div>*/}

      {/* Password Requirements */}
      {/*
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 mb-2">
                Password Requirements:
              </h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      securitySettings.newPassword.length >= 8
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <span>At least 8 characters</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      /[A-Z]/.test(securitySettings.newPassword)
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <span>One uppercase letter</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      /[a-z]/.test(securitySettings.newPassword)
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <span>One lowercase letter</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      /[0-9]/.test(securitySettings.newPassword)
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <span>One number</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      /[^A-Za-z0-9]/.test(securitySettings.newPassword)
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <span>One special character</span>
                </li>
              </ul>
            </div>
          </div>
{/*
          <Separator />

          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">
                  Two-Factor Authentication
                </h4>
                <p className="text-sm text-gray-600">
                  This feature is temporarily unavailable while we make improvements
                </p>
              </div>
              <Switch
                disabled={true}
                checked={false}
                onCheckedChange={() => {
                  setSecuritySettings((prev) => ({
                    ...prev,
                    twoFactorEnabled: false,
                  }));
                  onChangesDetected(true);
                }}
              />
            </div>

            {securitySettings.twoFactorEnabled && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  Two-factor authentication is enabled. You'll need to enter a
                  code from your authenticator app when signing in.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 bg-transparent"
                >
                  View Backup Codes
                </Button>
              </div>
            )}
          </div> 

          <Separator />*/}

      {/* Security Preferences - Commented out as requested */}
      {/* <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Security Preferences</h4>

            <div className="flex items-center justify-between">
              <div>
                <Label>Login Alerts</Label>
                <p className="text-sm text-gray-600">
                  Get notified of new sign-ins
                </p>
              </div>
              <Switch
                checked={securitySettings.loginAlerts}
                onCheckedChange={(checked) => {
                  setSecuritySettings((prev) => ({
                    ...prev,
                    loginAlerts: checked,
                  }));
                  onChangesDetected(true);
                }}
              />
            </div>

            <div>
              <Label>Session Timeout</Label>
              <Select
                value={securitySettings.sessionTimeout.toString()}
                onValueChange={(value) => {
                  setSecuritySettings((prev) => ({
                    ...prev,
                    sessionTimeout: Number.parseInt(value),
                  }));
                  onChangesDetected(true);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    {session.deviceInfo.includes("iPhone") ? (
                      <Smartphone className="h-5 w-5 text-gray-600" />
                    ) : (
                      <Monitor className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{session.deviceInfo}</p>
                    <p className="text-xs text-gray-500">
                      {session.location} • {formatLastActivity(session.lastActivity)}
                      {session.isCurrentSession && (
                        <Badge variant="outline" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  disabled={session.isCurrentSession}
                >
                  Sign out
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Preferences - Commented out as requested */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Account Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interface Preferences */}
      {/* <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Interface Preferences</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Theme</Label>
                <Select
                  value={preferences.theme}
                  onValueChange={(value) => {
                    setPreferences((prev) => ({ ...prev, theme: value }));
                    onChangesDetected(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Language</Label>
                <Select
                  value={preferences.language}
                  onValueChange={(value) => {
                    setPreferences((prev) => ({ ...prev, language: value }));
                    onChangesDetected(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Timezone</Label>
                <Select
                  value={preferences.timezone}
                  onValueChange={(value) => {
                    setPreferences((prev) => ({ ...prev, timezone: value }));
                    onChangesDetected(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">
                      Eastern Time
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      Central Time
                    </SelectItem>
                    <SelectItem value="America/Denver">
                      Mountain Time
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      Pacific Time
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Format</Label>
                <Select
                  value={preferences.dateFormat}
                  onValueChange={(value) => {
                    setPreferences((prev) => ({ ...prev, dateFormat: value }));
                    onChangesDetected(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Notification Preferences */}
      {/*
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              Notification Preferences
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => {
                    setPreferences((prev) => ({
                      ...prev,
                      emailNotifications: checked,
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive browser push notifications
                  </p>
                </div>
                <Switch
                  checked={preferences.pushNotifications}
                  onCheckedChange={(checked) => {
                    setPreferences((prev) => ({
                      ...prev,
                      pushNotifications: checked,
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>

              <div>
                <Label>Digest Frequency</Label>
                <Select
                  value={preferences.digestFrequency}
                  onValueChange={(value) => {
                    setPreferences((prev) => ({
                      ...prev,
                      digestFrequency: value,
                    }));
                    onChangesDetected(true);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Data & Privacy */}
      {/*
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Data & Privacy</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="justify-start bg-transparent"
              >
                <Download className="h-4 w-4 mr-2" />
                Export My Data
              </Button>

              <Button
                variant="outline"
                className="justify-start text-red-600 hover:text-red-700 bg-transparent"
    </div>
  

      <Separator />
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              Notification Preferences
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => {
                    setPreferences((prev) => ({
                      ...prev,
                      emailNotifications: checked,
                    }));
                    onChangesDetected(true);
                  }}
                />
              </div>
            }));
            onChangesDetected(true);
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Push Notifications</Label>
          <p className="text-sm text-gray-600">
            Receive browser push notifications
          </p>
        </div>
        <Switch
          checked={preferences.pushNotifications}
          onCheckedChange={(checked) => {
            setPreferences((prev) => ({
              ...prev,
              pushNotifications: checked,
            }));
            onChangesDetected(true);
          }}
        />
      </div>

      <div>
        <Label>Digest Frequency</Label>
        <Select
          value={preferences.digestFrequency}
          onValueChange={(value) => {
            setPreferences((prev) => ({
              ...prev,
              digestFrequency: value,
            }));
            onChangesDetected(true);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="realtime">Real-time</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>

  <Separator />*/}

      {/* Data & Privacy - Temporarily disabled */}
      {/* commented by uday
      <div className="space-y-4 mt-6">
        <h4 className="font-medium text-gray-900">Account Management</h4>
        <p className="text-sm text-gray-600">
          Account management features are temporarily disabled while we improve
          our services.
        </p>
      </div> */}

      {/* Reset Password Modal */}
      <ForgotPasswordModal
        isOpen={resetPasswordModalOpen}
        onClose={() => setResetPasswordModalOpen(false)}
        prefilledEmail={user?.email || ""}
      />
    </div>
  );
}
