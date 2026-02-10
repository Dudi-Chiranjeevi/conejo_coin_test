"use client";

import { useState, useEffect } from "react";
import { NGCEntryInterface } from "./ngc-entry-interface";
import { NGCDataPreviewModal } from "./ngc-data-preview-modal";
import { NGCFormIntegration } from "./ngc-form-integration";
import type {
  NGCApiResponse,
  LookupCertResponse,
  NGCData,
  ExistingCoin,
} from "../types/ngc";
import { inventoryItemApi } from "@/lib/services/inventory-service";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { mapApiResponseToNGCData } from "../types/ngc";
import { useAuth } from "@/app/auth/context/auth-context";

const DEFAULT_CLIENT_ID =
  process.env.CLIENT_ID || "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";
const COINS_CATEGORY_ID =
  process.env.COINS_CATEGORY_ID || "2e92c5be-7251-44a6-b9a2-c64d5f09855a";

export function NGCIntegration() {
  const [ngcData, setNGCData] = useState<NGCApiResponse | null>(null); // RAW
  const [lookupResp, setLookupResp] = useState<LookupCertResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<
    "entry" | "preview" | "form" | "saving" | "success"
  >("entry");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // No API call — read from env
    if (COINS_CATEGORY_ID) {
      setCategoryId(COINS_CATEGORY_ID);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      toast({
        title: "Missing Category ID",
        description: "Set COINS_CATEGORY_ID in .env variables",
        variant: "destructive",
      });
    }
  }, [toast]);

  // called by NGCEntryInterface when it found data (barcode or manual)
  const handleNGCDataFound = (
    raw: NGCApiResponse,
    lookup?: LookupCertResponse,
  ) => {
    setLookupResp(lookup ?? null);
    setNGCData(raw);

    // Initialize form data here with the transformed data
    const transformedData = mapApiResponseToNGCData(raw);
    const estimatedValue = 0;

    // Generate description directly from transformed data
    const certNumber = transformedData.certNumber || "";
    const grade = transformedData.grade || "";
    const gradeComment = transformedData.gradeComment || "";
    const year = transformedData.year ? transformedData.year.toString() : "";
    const coinType = transformedData.variety || "";
    const denomination = transformedData.denomination || "";

    const description = `NGC certified ${coinType} ${denomination} graded ${grade}${
      gradeComment ? ` (${gradeComment})` : ""
    }.${year ? ` Dated ${year}.` : ""}${
      certNumber ? ` Certificate #${certNumber}.` : ""
    }`;

    const initialFormData = {
      name: transformedData.title || "",
      category: "Coins",
      price: estimatedValue.toString(),
      description: description,
      status: "in_store", // Default status
      attributes: {
        certNumber: transformedData.certNumber || "",
        grade: transformedData.grade || "",
        gradeComment: transformedData.gradeComment || "",
        year: transformedData.year ? transformedData.year.toString() : "",
        mintMark: transformedData.mintMark || "",
        denomination: transformedData.denomination || "",
        metalType: transformedData.metalType || "",
        gradedDate: transformedData.gradedDate || "",
      },
      images: [
        transformedData.obverseUrl || "",
        transformedData.reverseUrl || "",
      ].filter((url) => url !== ""),
    };

    setFormData(initialFormData);
    setShowPreview(true);
    setCurrentStep("preview");
  };

  const handleError = (error: string) => {
    console.error("NGC Error:", error);
    toast({ title: "Error", description: error, variant: "destructive" });
  };

  // Confirm & Save — choose ONE of these strategies:

  // (A) Send RAW to backend (recommended — backend normalizes)
  const handleConfirm = async (mapped: NGCData) => {
    try {
      if (!categoryId || !ngcData) {
        toast({
          title: "Missing Data",
          description: "Category ID or NGC data missing.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("saving");
      const price = formData?.price ? parseFloat(formData.price) : 0;
      const name =
        formData?.name ||
        mapped.title ||
        ngcData.collectible?.variety1 ||
        ngcData.certNumber ||
        "Coin";
      const description = formData?.description || "";

      console.log(
        "Saving item with name:",
        name,
        "price:",
        price,
        "description:",
        description,
      );

      const savedItem = await inventoryItemApi.saveNGCDataToInventory(
        ngcData, // RAW payload from backend
        DEFAULT_CLIENT_ID,
        categoryId,
        price,
        "in_store",
        {
          // Pass optional parameters
          name: name,
          description: description,
          createdBy: user?.id,
        },
      );

      fetch("/api/v1/ngc-images/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certNumber: ngcData?.certNumber,
          frontUrl: ngcData?.images?.frontUrl,
          rearUrl: ngcData?.images?.rearUrl,
        }),
      }).catch((err) => console.error("Failed to sync NGC images:", err));

      setShowPreview(false);
      setCurrentStep("success");
      toast({
        title: "Item Saved",
        description: `Added ${savedItem.name} to inventory`,
      });
    } catch (error: any) {
      console.error("Error saving item:", error);
      setCurrentStep("preview");
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save item to inventory",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    // Keep the current form data when editing again
    // No need to reset or reinitialize form data here
    setShowPreview(false);
    setCurrentStep("form");

    // If this is a duplicate item, we still want to allow editing
    // The form will be populated with the existing data
    console.log("Editing item, formData:", formData);
  };

  const handleViewExisting = (coin: ExistingCoin) => {
    console.log("View existing coin:", coin);
    // navigate to existing item page if you have routing
  };

  const handleFormDataChange = (data: any) => {
    if (data === null) {
      // User clicked Cancel in the edit form
      // Return to preview with original data
      setCurrentStep("preview");
      setShowPreview(true);
    } else {
      // User clicked Save in the edit form
      // Update formData with the edited values
      setFormData(data);

      // Return to the preview modal with the updated data
      setCurrentStep("preview");
      setShowPreview(true);
    }
  };

  if (isLoading && currentStep === "entry") {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-12 w-12 animate-spin text-vividOrange mb-4" />
        <h3 className="text-xl font-semibold text-ink">Loading...</h3>
        <p className="text-gray-500 mt-2">Preparing NGC integration</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warmBg">
      {currentStep === "entry" && (
        <NGCEntryInterface
          onNGCDataFound={(raw, resp) =>
            handleNGCDataFound(
              raw as NGCApiResponse,
              resp as LookupCertResponse,
            )
          }
          onError={handleError}
        />
      )}

      {currentStep === "form" && (
        <div className="max-w-4xl mx-auto p-6">
          {/* optional form; not critical to this change */}
          <NGCFormIntegration
            ngcData={ngcData}
            onFormDataChange={handleFormDataChange}
          />
        </div>
      )}

      {currentStep === "saving" && (
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="h-12 w-12 animate-spin text-vividOrange mb-4" />
          <h3 className="text-xl font-semibold text-ink">
            Saving to Inventory...
          </h3>
          <p className="text-gray-500 mt-2">
            Please wait while we save your item
          </p>
        </div>
      )}

      {currentStep === "success" && (
        <div className="max-w-md mx-auto bg-goldYellow bg-opacity-10 p-8 rounded-lg border border-goldYellow text-center">
          {/* success UI */}
          <h2 className="text-2xl font-bold text-ink">Item Saved!</h2>
          <button
            onClick={() => setCurrentStep("entry")}
            className="mt-6 px-4 py-2 bg-vividOrange text-ink rounded hover:bg-goldYellow"
          >
            Add Another Item
          </button>
        </div>
      )}

      <NGCDataPreviewModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setCurrentStep("entry"); // Return to entry step when modal is closed
        }}
        ngcData={ngcData} // RAW
        formData={formData}
        isDuplicate={!!lookupResp?.is_duplicate}
        existingItem={lookupResp?.existing_inventory ?? undefined}
        onConfirm={handleConfirm} // mapped NGCData -> save RAW ngcData
        onEdit={handleEdit}
        onViewExisting={handleViewExisting}
      />
    </div>
  );
}
