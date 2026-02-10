"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Shield, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mapApiResponseToNGCData,
  mapExistingItemToNGCData,
  type NGCData,
  type NGCApiResponse,
} from "../types/ngc";

interface NGCFormIntegrationProps {
  ngcData: any; // Changed to any to handle raw API data
  onFormDataChange: (data: any) => void;
}

export function NGCFormIntegration({
  ngcData,
  onFormDataChange,
}: NGCFormIntegrationProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "Coins",
    price: "0",
    description: "",
    status: "in_store", // Default status
    attributes: {
      certNumber: "",
      grade: "",
      gradeComment: "",
      year: "",
      mintMark: "",
      denomination: "",
      metalType: "",
      gradedDate: "",
    },
    images: [] as string[],
  });

  // Debug: Log the incoming ngcData
  useEffect(() => {
    console.log("NGC Data received in form:", ngcData);
  }, [ngcData]);

  // Calculate estimated value based on NGC data
  const calculateEstimatedValue = useCallback(
    (data: any): number => {
      if (!data) return 0;

      const baseValues: Record<string, number> = {
        "MORGAN DOLLAR": 35,
        "PEACE DOLLAR": 30,
        "WALKING LIBERTY HALF": 25,
        "MADRAS PRESIDENCY": 75,
        "10CASH": 60, // Added specific value for 10CASH
      };

      const gradeMultipliers: Record<string, number> = {
        POOR: 0.1,
        FAIR: 0.2,
        AG: 0.3,
        G: 0.4,
        VG: 0.6,
        F: 0.8,
        VF: 1.0,
        XF: 1.5,
        AU: 2.0,
        "MS 60": 1.0,
        "MS 61": 1.2,
        "MS 62": 1.4,
        "MS 63": 1.8,
        "MS 64": 2.5,
        "MS 65": 4.0,
        "MS 66": 8.0,
        "MS 67": 15.0,
        "AU DETAILS": 1.8, // Added for your specific grade
      };

      // Use the same mapping approach as the preview modal
      let transformedData: NGCData;

      if (ngcData) {
        transformedData = mapApiResponseToNGCData(ngcData);
      } else {
        return 0;
      }

      const coinType = transformedData.variety || "";
      const grade = transformedData.grade || "";
      const denomination = transformedData.denomination || "";

      const baseValue = baseValues[coinType] || baseValues[denomination] || 50;
      const multiplier = gradeMultipliers[grade] || 1.0;

      return Math.round(baseValue * multiplier);
    },
    [ngcData]
  );

  // Effect 1: Update internal state when NGC data changes
  useEffect(() => {
    console.log("Processing NGC data:", ngcData);

    if (ngcData) {
      // Use the same mapping function as the preview modal for consistency
      const transformedData = mapApiResponseToNGCData(ngcData);

      // Extract data from the transformed data
      const certNumber = transformedData.certNumber || "";
      const grade = transformedData.grade || "";
      const gradeComment = transformedData.gradeComment || "";
      const year = transformedData.year ? transformedData.year.toString() : "";
      const mintMark = transformedData.mintMark || "";
      const denomination = transformedData.denomination || "";
      const coinType = transformedData.variety || "";
      const metalType = transformedData.metalType || "";
      const gradedDate = transformedData.gradedDate || "";
      const obverseUrl = transformedData.obverseUrl || "";
      const reverseUrl = transformedData.reverseUrl || "";

      const estimatedValue = calculateEstimatedValue(ngcData);

      const newFormData = {
        // Use the title from the transformed data for consistency with the preview modal
        name: transformedData.title || "",
        category: "Coins",
        price: "0.00", // Always default to 0.00 as requested
        description: `NGC certified ${coinType} ${denomination} graded ${grade}${
          gradeComment ? ` (${gradeComment})` : ""
        }.${year ? ` Dated ${year}.` : ""}${
          certNumber ? ` Certificate #${certNumber}.` : ""
        }`,
        status: "in_store", // Default status
        attributes: {
          certNumber,
          grade,
          gradeComment,
          year,
          mintMark,
          denomination,
          metalType,
          gradedDate,
        },
        images: [obverseUrl, reverseUrl].filter(
          (url) => url && url !== ""
        ) as string[],
      };

      // Always initialize form data when NGC data is provided
      // This ensures the form is properly populated when clicking "Edit Details First"
      console.log("Initializing form data with NGC data");
      setFormData(newFormData);
    }
  }, [ngcData, calculateEstimatedValue]);

  // Effect 2: Notify parent when form data changes
  useEffect(() => {
    // console.log("Form data changed:", formData);
    // We don't want to automatically notify the parent on every form change
    // Instead, we'll only notify when the Save button is clicked
    // onFormDataChange(formData);
  }, [formData]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAttributeChange = useCallback(
    (attribute: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        attributes: { ...prev.attributes, [attribute]: value },
      }));
    },
    []
  );

  // Handle save button click
  const handleSave = () => {
    console.log("Save button clicked, sending form data:", formData);
    // Pass the updated form data back to the parent component
    onFormDataChange(formData);
  };

  // Handle cancel button click
  const handleCancel = () => {
    console.log("Cancel button clicked");
    // Pass null to indicate cancellation
    onFormDataChange(null);
  };

  const NGCField = ({
    label,
    value,
    onChange,
    locked = false,
    tooltip,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    locked?: boolean;
    tooltip?: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {ngcData && locked && (
          <Badge className="bg-blue-100 text-blue-800 text-xs">NGC</Badge>
        )}
        {locked && (
          <Tooltip>
            <TooltipTrigger>
              <Lock className="h-3 w-3 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip || "This data comes from NGC certification"}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked && !!ngcData}
        className={locked && ngcData ? "bg-gray-50 text-gray-600" : ""}
        spellCheck="false"
        autoComplete="off"
        onFocus={(e) => e.target.select()}
      />
    </div>
  );

  // Check if we have any NGC data at all
  const hasNGCData = ngcData && Object.keys(ngcData).length > 0;

  if (!hasNGCData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No NGC data available</p>
          <p className="text-sm text-gray-400 mt-2">
            Please provide NGC certificate data
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Status Card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">
                    NGC Certified Coin
                  </h3>
                  <p className="text-sm text-green-700">
                    Data automatically populated from NGC certification
                    {formData.attributes.certNumber &&
                      ` #${formData.attributes.certNumber}`}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800 ml-auto">
                  Authenticated
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field - Now editable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Item Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="Enter item name..."
                  spellCheck="false"
                  autoComplete="off"
                  onFocus={(e) => e.target.select()}
                />
                <p className="text-xs text-gray-500">
                  This name will be used to identify the item in your inventory.
                </p>
              </div>

              {/* Status field */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleFieldChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_store">In Store</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    {/* <SelectItem value="reserved">Reserved</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>

              {/* Price field */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Price
                  {hasNGCData && (
                    <>
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Estimated
                      </Badge>
                    </>
                  )}
                </Label>
                <Input
                  type="text"
                  value={formData.price}
                  onChange={(e) => handleFieldChange("price", e.target.value)}
                  placeholder="Enter price..."
                  className="w-full"
                  spellCheck="false"
                  autoComplete="off"
                  onFocus={(e) => e.target.select()}
                />
                {hasNGCData && (
                  <p className="text-xs text-gray-500">
                    Estimated value based on grade and coin type. You can adjust
                    this price.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  rows={3}
                  placeholder="Enter item description..."
                  spellCheck="false"
                  autoComplete="off"
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </CardContent>
          </Card>

          {/* NGC Specific Attributes */}
          {hasNGCData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  NGC Certification Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NGCField
                    label="Certificate Number"
                    value={formData.attributes.certNumber}
                    onChange={(value) =>
                      handleAttributeChange("certNumber", value)
                    }
                    locked={true}
                  />

                  <NGCField
                    label="Grade"
                    value={formData.attributes.grade}
                    onChange={(value) => handleAttributeChange("grade", value)}
                    locked={true}
                  />

                  <NGCField
                    label="Year"
                    value={formData.attributes.year}
                    onChange={(value) => handleAttributeChange("year", value)}
                    locked={true}
                  />

                  <NGCField
                    label="Mint Mark"
                    value={formData.attributes.mintMark}
                    onChange={(value) =>
                      handleAttributeChange("mintMark", value)
                    }
                    locked={true}
                  />

                  <NGCField
                    label="Denomination"
                    value={formData.attributes.denomination}
                    onChange={(value) =>
                      handleAttributeChange("denomination", value)
                    }
                    locked={true}
                  />

                  <NGCField
                    label="Metal Type"
                    value={formData.attributes.metalType}
                    onChange={(value) =>
                      handleAttributeChange("metalType", value)
                    }
                    locked={true}
                  />
                </div>

                {formData.attributes.gradeComment && (
                  <NGCField
                    label="Grade Comment"
                    value={formData.attributes.gradeComment}
                    onChange={(value) =>
                      handleAttributeChange("gradeComment", value)
                    }
                    locked={true}
                  />
                )}

                <NGCField
                  label="Graded Date"
                  value={formData.attributes.gradedDate}
                  onChange={(value) =>
                    handleAttributeChange("gradedDate", value)
                  }
                  locked={true}
                />
              </CardContent>
            </Card>
          )}

          {/* Images */}
          {hasNGCData && formData.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  NGC Coin Images
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    Auto-Added
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {formData.images[0] && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Obverse (Front)
                      </p>
                      <img
                        src={formData.images[0]}
                        alt="Coin Obverse"
                        className="w-full h-32 object-contain rounded-lg border"
                      />
                    </div>
                  )}
                  {formData.images[1] && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Reverse (Back)
                      </p>
                      <img
                        src={formData.images[1]}
                        alt="Coin Reverse"
                        className="w-full h-32 object-contain rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add buttons at the bottom */}
        <div className="flex justify-end gap-4 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
