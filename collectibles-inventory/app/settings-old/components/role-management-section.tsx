"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mockUserRoles,
  mockPermissionModules,
  type UserRole,
} from "../types/user-management";

interface RoleManagementSectionProps {
  onChangesDetected: (hasChanges: boolean) => void;
}

export function RoleManagementSection({
  onChangesDetected,
}: RoleManagementSectionProps) {
  const [roles, setRoles] = useState<UserRole[]>(mockUserRoles);
  const [showCreateRole, setShowCreateRole] = useState(false);

  return (
    <div className="space-y-6">
      {/* Role Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            <Button
              onClick={() => setShowCreateRole(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {roles.map((role) => (
              <Card
                key={role.id}
                className="border-2 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <h3 className="font-medium">{role.name}</h3>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                      {role.isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    {role.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Users className="h-3 w-3" />
                      <span>{role.userCount} users</span>
                    </div>
                    {!role.isCustom && (
                      <Badge variant="secondary" className="text-xs">
                        System Role
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Permission Matrix */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Permission Matrix</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Module</TableHead>
                    {roles.slice(0, 5).map((role) => (
                      <TableHead key={role.id} className="text-center min-w-24">
                        <div className="flex flex-col items-center space-y-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="text-xs">{role.name}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPermissionModules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">
                        {module.name}
                      </TableCell>
                      {roles.slice(0, 5).map((role) => (
                        <TableCell key={role.id} className="text-center">
                          <div className="flex flex-col space-y-1">
                            {module.permissions.map((permission) => (
                              <Checkbox
                                key={permission}
                                checked={Math.random() > 0.3} // Mock permission state
                                className="mx-auto"
                                title={`${role.name} - ${permission}`}
                              />
                            ))}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
