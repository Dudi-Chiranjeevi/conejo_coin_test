"use client";

import { useState, useEffect } from "react";
import { Search, Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { env } from "@/app/config/env";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// FRONTEND Client shape used in UI
interface Client {
  id: string; // UUID from Django
  client_name: string; // mapped from backend `name`
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

// API responses
interface ClientsApiResponse {
  success: boolean;
  clients?: Client[];
  count?: number;
  error?: string;
}

// Email validation helper function
const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email.trim()) {
    return { isValid: true }; // Empty email is allowed (optional field)
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return { 
      isValid: false, 
      error: "Please enter a valid email address (e.g., user@example.com)" 
    };
  }

  // Additional validations
  if (email.length > 254) {
    return { 
      isValid: false, 
      error: "Email address is too long (maximum 254 characters)" 
    };
  }

  const [localPart, domain] = email.split('@');
  
  if (localPart.length > 64) {
    return { 
      isValid: false, 
      error: "Email local part is too long (maximum 64 characters)" 
    };
  }

  if (domain.length > 253) {
    return { 
      isValid: false, 
      error: "Email domain is too long (maximum 253 characters)" 
    };
  }

  // Check for consecutive dots
  if (email.includes('..')) {
    return { 
      isValid: false, 
      error: "Email address cannot contain consecutive dots" 
    };
  }

  // Check for valid domain extension (at least 2 characters)
  const domainParts = domain.split('.');
  if (domainParts.length < 2 || domainParts[domainParts.length - 1].length < 2) {
    return { 
      isValid: false, 
      error: "Email domain extension must be at least 2 characters" 
    };
  }

  return { isValid: true };
};

// Helper: convert backend (Django model) -> frontend Client
const backendToFrontendClient = (backend: any): Client => {
  return {
    id: backend.id,
    client_name: backend.name?.toLowerCase() || "",
    contact_email: backend.contact_email?.toLowerCase() || "",
    created_at: backend.created_at,
    updated_at: backend.updated_at,
  } as Client;
};

// Helper: convert frontend -> backend payload for create/update
const frontendToBackendPayload = (data: Partial<Client>) => {
  return {
    name: data.client_name?.trim().toLowerCase() || '',
    contact_email: data.contact_email?.trim().toLowerCase() || '',
  };
};

// Add/Edit Client Modal Component
interface AddEditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (clientData: Client) => void;
  existingClients: Client[];
}

function AddEditClientModal({ isOpen, onClose, client, onSave, existingClients }: AddEditClientModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    client_name: "",
    contact_email: "",
  });
  const [formErrors, setFormErrors] = useState<{
    client_name?: string;
    contact_email?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        client_name: client.client_name || "",
        contact_email: client.contact_email || "",
      });
    } else {
      setFormData({
        client_name: "",
        contact_email: "",
      });
    }
    // Clear errors when modal opens/closes or client changes
    setFormErrors({});
  }, [client, isOpen]);

  // Add the duplicate email checking function
  const checkDuplicateEmail = (email: string, currentClientId?: string): boolean => {
    if (!email) return false;

    const normalizedEmail = email.toLowerCase().trim();
    
    return existingClients.some(existingClient => {
      // Skip the current client when editing
      if (currentClientId && existingClient.id === currentClientId) {
        return false;
      }
      
      return existingClient.contact_email?.toLowerCase().trim() === normalizedEmail;
    });
  };

  const validateForm = (): boolean => {
    const errors: { client_name?: string; contact_email?: string } = {};

    // Client name validation
    if (!formData.client_name.trim()) {
      errors.client_name = "Client name is required";
    } else if (formData.client_name.trim().length < 2) {
      errors.client_name = "Client name must be at least 2 characters long";
    } else if (formData.client_name.trim().length > 255) {
      errors.client_name = "Client name is too long (maximum 255 characters)";
    }

    // Email validation
    if (formData.contact_email) {
      const emailValidation = validateEmail(formData.contact_email);
      if (!emailValidation.isValid) {
        errors.contact_email = emailValidation.error;
      } else {
        // Check for duplicate email (only if email is provided and valid)
        const isDuplicate = checkDuplicateEmail(
          formData.contact_email.trim().toLowerCase(), 
          client?.id
        );
        
        if (isDuplicate) {
          errors.contact_email = "This email is already associated with another client";
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = frontendToBackendPayload(formData);
      const API_BASE_URL = env.api.baseUrl;
      const url = client
        ? `${API_BASE_URL}/api/v1/clients/${client.id}/`
        : `${API_BASE_URL}/api/v1/clients/`;
      const method = client ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle backend duplicate email error
        if (response.status === 400 && result.error?.includes('email')) {
          setFormErrors(prev => ({
            ...prev,
            contact_email: "This email is already associated with another client"
          }));
          return;
        }
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.error || "Operation failed");
      }

      const savedBackendClient = result.client;
      const frontendClient = backendToFrontendClient(savedBackendClient);
      onSave(frontendClient);

      onClose();

      toast({
        title: client ? "Client updated" : "Client created",
        description: client
          ? "Client has been updated successfully."
          : "New client has been created successfully.",
      });
    } catch (error) {
      console.error("Error saving client:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear field error when user starts typing
    if (formErrors[field as keyof typeof formErrors]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }

    // Real-time duplicate check for email (optional)
    if (field === "contact_email" && value.trim()) {
      const emailValidation = validateEmail(value);
      if (emailValidation.isValid) {
        const isDuplicate = checkDuplicateEmail(value, client?.id);
        if (isDuplicate) {
          setFormErrors(prev => ({
            ...prev,
            contact_email: "This email is already associated with another client"
          }));
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {client ? "Update the client information below." : "Enter the details for the new client."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_name">Client Name *</Label>
            <Input
              id="client_name"
              type="text"
              placeholder="Enter client name"
              value={formData.client_name}
              onChange={(e) => handleChange("client_name", e.target.value)}
              required
              className={formErrors.client_name ? "border-red-500" : ""}
            />
            {formErrors.client_name && (
              <p className="text-sm text-red-500">{formErrors.client_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="Enter contact email"
              value={formData.contact_email}
              onChange={(e) => handleChange("contact_email", e.target.value)}
              className={formErrors.contact_email ? "border-red-500" : ""}
            />
            {formErrors.contact_email && (
              <p className="text-sm text-red-500">{formErrors.contact_email}</p>
            )}
            {!formErrors.contact_email && (
              <p className="text-sm text-gray-500">
                (e.g., user@example.com)
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : client ? "Update Client" : "Create Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientManagementTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]); // Store all clients for total count
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const API_BASE_URL = env.api.baseUrl;

  // Fetch all clients (without search) for total count
  const fetchAllClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/clients/`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const data: ClientsApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch clients");
      }

      const normalized = (data.clients || []).map(backendToFrontendClient);
      setAllClients(normalized);
      return normalized;
    } catch (err) {
      console.error("Error fetching all clients:", err);
      return [];
    }
  };

  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // If no search term, fetch all clients
      if (!searchTerm) {
        const allClientsData = await fetchAllClients();
        setClients(allClientsData);
      } else {
        // If search term exists, fetch filtered clients
        const url = `${API_BASE_URL}/api/v1/clients/?q=${encodeURIComponent(searchTerm)}`;
        
        const response = await fetch(url, {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        const data: ClientsApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch clients");
        }

        const normalized = (data.clients || []).map(backendToFrontendClient);
        setClients(normalized);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load - fetch all clients
  useEffect(() => {
    const initializeClients = async () => {
      try {
        setIsLoading(true);
        const allClientsData = await fetchAllClients();
        setClients(allClientsData);
      } catch (err) {
        console.error("Error initializing clients:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    initializeClients();
  }, []);

  // Fetch clients when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchClients();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle save client - update both clients and allClients
  const handleSaveClient = (savedClient: Client) => {
    if (editingClient) {
      // Update existing client in both lists
      const updateClientInList = (list: Client[]) => 
        list.map((c) => (c.id === savedClient.id ? savedClient : c));
      
      setClients(prev => updateClientInList(prev));
      setAllClients(prev => updateClientInList(prev));
    } else {
      // Add new client to both lists
      setClients(prev => [savedClient, ...prev]);
      setAllClients(prev => [savedClient, ...prev]);
    }
    setEditingClient(null);
    setShowAddClientModal(false);
  };

  // Handle deletion (single)
  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/clients/${clientId}/`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to delete client");
      }

      // Remove from both lists
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      setAllClients((prev) => prev.filter((c) => c.id !== clientId));
      setSelectedClients((prev) => prev.filter((id) => id !== clientId));

      toast({
        title: "Client deleted",
        description: "Client has been deleted successfully.",
      });
    } catch (err) {
      console.error("Error deleting client:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  // Bulk delete using the custom action
  const handleBulkDelete = async () => {
    if (selectedClients.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedClients.length} client(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/clients/bulk-delete/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_ids: selectedClients }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to delete clients");
      }

      // Refresh both client lists
      const allClientsData = await fetchAllClients();
      setClients(searchTerm ? allClientsData.filter(client => 
        client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
      ) : allClientsData);
      setSelectedClients([]);

      toast({
        title: "Clients deleted",
        description: `${result.deleted_count || selectedClients.length} client(s) have been deleted successfully.`,
      });
    } catch (err) {
      console.error("Error in bulk delete:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete clients",
        variant: "destructive",
      });
    }
  };

  // Selection handlers
  const handleSelectClient = (clientId: string, selected: boolean) => {
    if (selected) {
      setSelectedClients((prev) => [...prev, clientId]);
    } else {
      setSelectedClients((prev) => prev.filter((id) => id !== clientId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedClients(clients.map((client) => client.id));
    } else {
      setSelectedClients([]);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (error && !clients.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error loading clients</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchClients}>Try Again</Button>
        </div>
      </div>
    );
  }

  const formatDisplayName = (name: string): string => {
    return name.toLowerCase();
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Client Management</h1>
        </div>
        <Button onClick={() => setShowAddClientModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Clients Table */}
      <Card>
        <CardContent className="p-0">
          {/* Search and Filters */}
          <div className="p-6 border-b">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input 
                    placeholder="Search clients by name or email..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-10" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedClients.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 border-b">
              <span className="text-sm font-medium text-blue-900">
                {selectedClients.length} client{selectedClients.length > 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 bg-transparent" 
                  onClick={handleBulkDelete}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* Clients Table */}
          <div className="rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedClients.length === clients.length && clients.length > 0} 
                      onCheckedChange={handleSelectAll} 
                    />
                  </TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : clients.length > 0 ? (
                  clients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox 
                          checked={selectedClients.includes(client.id)} 
                          onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {client.client_name?.charAt(0)?.toUpperCase() || "C"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatDisplayName(client.client_name)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {client.contact_email ? formatDisplayName(client.contact_email) : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {formatDate(client.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {formatDate(client.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingClient(client)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600" 
                              onClick={() => handleDeleteClient(client.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? "No clients found matching your search" : "No clients found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - UPDATED */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-gray-700">
              Showing {clients.length} of {allClients.length} client{allClients.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Client Modal */}
      <AddEditClientModal
        isOpen={showAddClientModal || !!editingClient}
        onClose={() => {
          setShowAddClientModal(false);
          setEditingClient(null);
        }}
        client={editingClient}
        onSave={handleSaveClient}
        existingClients={allClients}
      />
    </div>
  );
}