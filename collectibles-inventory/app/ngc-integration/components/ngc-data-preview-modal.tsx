"use client";

import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle, CheckCircle, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { inventoryItemApi } from "@/lib/services/inventory-service";

import {
  mapApiResponseToNGCData,
  mapExistingItemToNGCData,
  type NGCApiResponse,
  type NGCData,
  type ExistingCoin,
} from "../types/ngc";

// Default client ID - should be configured in environment
const DEFAULT_CLIENT_ID =
  process.env.CLIENT_ID || "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";
const COINS_CATEGORY_ID =
  process.env.COINS_CATEGORY_ID || "2e92c5be-7251-44a6-b9a2-c64d5f09855a";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  ngcData: NGCApiResponse | null; // RAW
  formData?: any;
  onConfirm: (mapped: NGCData) => void; // mapped back up
  onEdit: () => void;

  isDuplicate?: boolean;
  existingItem?: ExistingCoin;
  onViewExisting?: (coin: ExistingCoin) => void;
};

export function NGCDataPreviewModal({
  isOpen,
  onClose,
  ngcData,
  formData,
  onConfirm,
  onEdit,
  isDuplicate: initialIsDuplicate = false,
  existingItem: initialExistingItem,
  onViewExisting,
}: Props) {
  const [imageZoom, setImageZoom] = useState<"obverse" | "reverse" | null>(
    null
  );
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [showNameConfirmation, setShowNameConfirmation] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [transformedData, setTransformedData] = useState<NGCData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(initialIsDuplicate);
  const [existingItem, setExistingItem] = useState(initialExistingItem);
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const { toast } = useToast();

  const mapped: NGCData = useMemo(() => {
    if (existingItem) return mapExistingItemToNGCData(existingItem);
    return mapApiResponseToNGCData(ngcData);
  }, [existingItem, ngcData]);

  // The duplicate check is already handled by the lookup_cert endpoint
  // We just need to use the existing item data passed from the parent component
  useEffect(() => {
    // If we have existing item data from the lookup_cert endpoint, use it
    if (initialIsDuplicate && initialExistingItem) {
      console.log("Setting duplicate state from props:", { initialIsDuplicate, initialExistingItem });
      setIsDuplicate(true);
      setExistingItem(initialExistingItem);
    }
  }, [initialIsDuplicate, initialExistingItem]);
  
  // Additional effect to ensure isDuplicate state is properly synchronized
  useEffect(() => {
    if (initialIsDuplicate !== isDuplicate) {
      console.log("Synchronizing duplicate state with props:", { initialIsDuplicate, currentState: isDuplicate });
      setIsDuplicate(initialIsDuplicate);
    }
  }, [initialIsDuplicate, isDuplicate]);

  useEffect(() => {
    let data: NGCData | null = null;

    if (ngcData) {
      // If we have NGC API data, use it
      data = mapApiResponseToNGCData(ngcData);
    } else if (isDuplicate && existingItem) {
      // For duplicates, map from the existing inventory item
      console.log("Using existing inventory data:", existingItem);
      // console.log("Existing inventory attributes:", existingItem.attributes);
      // console.log("Existing inventory images:", existingItem.images);
      data = mapExistingItemToNGCData(existingItem);
      console.log("Mapped existing inventory data:", data);
    }

    // Apply any form data overrides if available
    if (data && formData) {
      data = {
        ...data,
        title: formData.name || data.title,
        // Add other fields that might be edited in the form
        description: formData.description || data.description,
      };
    }

    setTransformedData(data);

    // Set the editable name when data changes
    if (data?.title) {
      setEditableName(data.title);
    }
  }, [ngcData, isDuplicate, existingItem, formData]);

  // Direct API call function
  const handleDirectSave = async () => {
    if (!ngcData || !transformedData) {
      toast({
        title: "Missing Data",
        description: "NGC data is missing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const price = formData?.price ? parseFloat(formData.price) : 0;
      const name =
        formData?.name || editableName || transformedData?.title || "Coin";

      // Generate a detailed description if none provided
      let description = formData?.description || "";

      // If no custom description was provided, generate one from NGC data
      if (!description && transformedData) {
        const certNumber = transformedData.certNumber || "";
        const grade = transformedData.grade || "";
        const gradeComment = transformedData.gradeComment || "";
        const year = transformedData.year || "";
        const coinType = transformedData.variety || "";
        const denomination = transformedData.denomination || "";

        description = `NGC certified ${coinType} ${denomination} graded ${grade}${
          gradeComment ? ` (${gradeComment})` : ""
        }.${year ? ` Dated ${year}.` : ""}${
          certNumber ? ` Certificate #${certNumber}.` : ""
        }`;
      }

      console.log("Direct API call - Saving item with name:", name);
      console.log("Using description:", description);
      console.log("Using category ID:", COINS_CATEGORY_ID);
      console.log("Using client ID:", DEFAULT_CLIENT_ID);

      if (!COINS_CATEGORY_ID) {
        toast({
          title: "Missing Category ID",
          description: "Category ID is required to save the item.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Create a clean version of ngcData to avoid circular references
      const cleanNgcData = JSON.parse(JSON.stringify(ngcData));

      // Create the payload in the format expected by the backend
      const payload = {
        client_id: DEFAULT_CLIENT_ID,
        category_id: COINS_CATEGORY_ID,
        status: "in_store",
        price: price,
        location_id: null,
        notes: "",
        description: description,
        name: name,
        ngc_data: cleanNgcData, // send raw; server will normalize
      };

      console.log("API call payload:", JSON.stringify(payload, null, 2));
      console.log("API endpoint:", `/api/v1/ngc-integration/from-ngc/`);
      console.log("Category ID being used:", payload.category_id);
      console.log("Client ID being used:", payload.client_id);

      // If this is a duplicate, don't try to save it again
      // Double-check both the state and the props to ensure we catch all duplicate cases
      if (isDuplicate || initialIsDuplicate) {
        console.log("Preventing save of duplicate item", { isDuplicate, initialIsDuplicate });
        toast({
          title: "Certificate Already Exists",
          description: "This certificate already exists in your inventory.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      
      // Make the API call directly instead of using the service
      // Use the appropriate backend URL based on environment
      const baseUrl = process.env.BACKEND_URL || 
                     "https://www.conejocoin.net" || 
                     "https://conejo-backend-146447649143.us-central1.run.app";
      
      console.log("Using backend URL:", baseUrl);
      
      const response = await fetch(`${baseUrl}/api/v1/ngc-integration/from-ngc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include", // Include cookies for authentication
      });

      if (!response.ok) {
        // Try to parse error response as JSON
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error("API error response:", errorData);
          errorMessage = errorData.detail || errorData.error || errorMessage;
          
          // Special handling for common errors
          if (response.status === 409) {
            errorMessage = "This certificate already exists in your inventory.";
          } else if (response.status === 404) {
            errorMessage = "The API endpoint was not found. Please check your backend configuration.";
          }
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        
        throw new Error(errorMessage);
      }

      const savedItem = await response.json();
      console.log("API call successful, response:", savedItem);

      setIsSaving(false);
      setShowNameConfirmation(false);
      setShowSuccessMessage(true); // Show success message dialog

      // Also show toast for redundancy
      toast({
        title: "Item Saved",
        description: `Added ${savedItem.name || name} to inventory`,
      });
    } catch (error: any) {
      console.error("Error saving item directly:", error);
      console.error(
        "Error details:",
        error?.response?.data || error?.message || "Unknown error"
      );
      setIsSaving(false);
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save item to inventory",
        variant: "destructive",
      });
    }
  };

  const DataField = ({ label, value }: { label: string; value: any }) => {
    const displayValue =
      value !== undefined && value !== null && value !== ""
        ? String(value)
        : "—";
    return (
      <div className="p-3 bg-warmBg rounded-lg">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-lg">{displayValue}</p>
      </div>
    );
  };

  const formatPrice = (price?: number | string): string => {
    if (price === undefined || price === null || price === "") return "";
    const n = typeof price === "string" ? parseFloat(price) : price;
    if (isNaN(n as number)) return "";
    return `$${(n as number).toFixed(2)}`;
  };

  // If we don't have transformed data, don't render anything
  if (!transformedData) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-ink">NGC Item Preview</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              {/* Duplicate Warning */}
              {isDuplicate && (
                <Alert className="mb-4 border-goldYellow bg-goldYellow bg-opacity-10">
                  <AlertTriangle className="h-5 w-5 text-vividOrange" />
                  <AlertDescription className="text-ink">
                    This item already exists in your inventory.
                  </AlertDescription>
                </Alert>
              )}

              {/* Main Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Images */}
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    {transformedData.obverseUrl && (
                      <div
                        className="aspect-square rounded-lg overflow-hidden border border-lightBorder cursor-pointer"
                        onClick={() => setImageZoom("obverse")}
                      >
                        <img
                          src={transformedData.obverseUrl}
                          alt="Coin Obverse"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {transformedData.reverseUrl && (
                      <div
                        className="aspect-square rounded-lg overflow-hidden border border-lightBorder cursor-pointer"
                        onClick={() => setImageZoom("reverse")}
                      >
                        <img
                          src={transformedData.reverseUrl}
                          alt="Coin Reverse"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click images to enlarge
                  </p>
                </div>

                {/* Right Column - Details */}
                <div className="space-y-4">
                  {/* Title and Grade */}
                  <div>
                    <h3 className="text-xl font-bold text-ink">
                      {isDuplicate && existingItem
                        ? existingItem.name
                        : formData?.name ||
                          transformedData.title ||
                          "Unknown Coin"}
                    </h3>
                    <div className="flex items-center mt-2">
                      <Badge className="bg-goldYellow text-ink">
                        Grade: {transformedData.grade}
                      </Badge>
                      {transformedData.gradeComment && (
                        <span className="ml-2 text-sm text-gray-600">
                          ({transformedData.gradeComment})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Certificate */}
                  <div>
                    <p className="text-sm text-gray-600">
                      Certificate #{transformedData.certNumber}
                    </p>
                    {transformedData.gradedDate && (
                      <p className="text-sm text-gray-600">
                        Graded: {transformedData.gradedDate}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <p className="text-lg font-bold text-vividOrange">
                      {formatPrice(formData?.price || transformedData.price)}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-sm text-ink">
                      {formData?.description ||
                        transformedData.description ||
                        ""}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <DataField label="Year" value={transformedData.year} />
                    <DataField
                      label="Denomination"
                      value={transformedData.denomination}
                    />
                    <DataField
                      label="Variety"
                      value={transformedData.variety}
                    />
                    <DataField
                      label="Metal Type"
                      value={transformedData.metalType}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-3">
              {/* View Existing Item button removed as requested */}

              {/* Debug button*/}
              {/* <Button
                variant="outline"
                onClick={() => console.log("Debug data:", { transformedData, ngcData, existingItem })}
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                View Data
              </Button> */}

              <Button
                variant="outline"
                onClick={() => {
                  // Handle differently based on whether this is a duplicate or not
                  if (isDuplicate && existingItem) {
                    // For duplicates, show a message and redirect to inventory page
                    toast({
                      title: "Certificate Already Exists",
                      description: "Redirecting to inventory where you can edit this item.",
                      variant: "default",
                    });
                    
                    // Create a URL to search for the item by certificate number
                    const searchUrl = `/inventory-management?search=${transformedData.certNumber}`;
                    
                    // Use the modern AlertDialog instead of window.confirm
                    setShowRedirectDialog(true);
                    setRedirectUrl(searchUrl);
                  } else {
                    // For new items, proceed with normal edit flow
                    console.log("Editing new NGC item", { transformedData, ngcData });
                    
                    // Call the onEdit function to switch to the form view
                    // This will use the ngcData already set in the parent component
                    onEdit();
                  }
                }}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                Edit Details First
              </Button>

              {/* Only show Confirm & Save button if NOT a duplicate */}
              {!isDuplicate ? (
                <Button
                  onClick={() => {
                    // Show name confirmation dialog first
                    setShowNameConfirmation(true);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Confirm & Save Item"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>

        {/* Image Zoom */}
        {imageZoom && (
          <Dialog open={!!imageZoom} onOpenChange={() => setImageZoom(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {imageZoom === "obverse"
                    ? "Obverse (Front)"
                    : "Reverse (Back)"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex justify-center">
                <img
                  src={
                    imageZoom === "obverse"
                      ? transformedData.obverseUrl
                      : transformedData.reverseUrl
                  }
                  alt={
                    imageZoom === "obverse" ? "Coin Obverse" : "Coin Reverse"
                  }
                  className="max-h-[70vh] object-contain"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Dialog>

      {/* Name Confirmation Dialog */}
      <Dialog
        open={showNameConfirmation}
        onOpenChange={setShowNameConfirmation}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Item Name</DialogTitle>
            <DialogDescription>
              Please confirm or edit the name for this inventory item:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                className="text-lg"
              />
            </div>

            <div className="text-sm text-gray-500">
              <p>
                This name will be used to identify the item in your inventory.
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setShowNameConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Validate name is not empty
                if (!editableName.trim()) {
                  toast({
                    title: "Name Required",
                    description: "Please enter a name for this item.",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Proceed with save
                handleDirectSave();
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Confirm Name & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Message Dialog */}
      <Dialog
        open={showSuccessMessage}
        onOpenChange={(open) => {
          setShowSuccessMessage(open);
          if (!open) {
            onClose(); // Close the parent modal too when success dialog is closed
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600">Success!</DialogTitle>
          </DialogHeader>

          <div className="py-6">
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle className="text-green-800">
                Item Added Successfully
              </AlertTitle>
              <AlertDescription className="text-green-700">
                The NGC item has been successfully added to your inventory.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSuccessMessage(false);
                onClose(); // Close the parent modal too
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Redirect Confirmation Dialog */}
      <AlertDialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Certificate Already Exists</AlertDialogTitle>
          <AlertDialogDescription>
            This certificate already exists in your inventory. Would you like to go to the inventory page where you can edit this item?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRedirectDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (redirectUrl) {
                  window.location.href = redirectUrl;
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Inventory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
