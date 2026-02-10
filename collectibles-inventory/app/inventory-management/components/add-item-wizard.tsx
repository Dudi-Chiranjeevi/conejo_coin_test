"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/app/auth/context/auth-context";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Upload as UploadIcon,
  X,
  Info,
  CheckCircle,
  Truck,
  Handshake,
  ExternalLink,
  Check,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { type InventoryItem } from "../types/inventory";
import { inventoryApi } from "../services/api";
import { useFileUpload } from "@/app/hooks/useFileUpload";

// GCS Configuration
type GCSConfig = {
  projectId: string;
  bucketName: string;
};

const gcsConfig: GCSConfig = {
  projectId: process.env.NEXT_PUBLIC_GCS_PROJECT_ID || "your-project-id",
  bucketName: "coenjocoins_inventory",
};

/** ---------- Location options (sample; swap to API-driven if you have endpoints) ---------- */
type NodeOption = { id: string; label: string; parentId?: string };

const sites: NodeOption[] = [
  { id: "site-a", label: "Site A" },
  { id: "site-b", label: "Site B" },
];

const rooms: NodeOption[] = [
  { id: "room-a1", label: "Room A1", parentId: "site-a" },
  { id: "room-a2", label: "Room A2", parentId: "site-a" },
  { id: "room-b1", label: "Room B1", parentId: "site-b" },
];

const shelves: NodeOption[] = [
  { id: "shelf-a1-1", label: "Shelf 1", parentId: "room-a1" },
  { id: "shelf-a1-2", label: "Shelf 2", parentId: "room-a1" },
  { id: "shelf-a2-1", label: "Shelf 1", parentId: "room-a2" },
  { id: "shelf-b1-1", label: "Shelf 1", parentId: "room-b1" },
];

const rows: NodeOption[] = [
  { id: "row-a1-1-1", label: "Row 1", parentId: "shelf-a1-1" },
  { id: "row-a1-1-2", label: "Row 2", parentId: "shelf-a1-1" },
  { id: "row-a1-2-1", label: "Row 1", parentId: "shelf-a1-2" },
  { id: "row-b1-1-1", label: "Row 1", parentId: "shelf-b1-1" },
];

const boxes: NodeOption[] = [
  { id: "box-a1-1-1-1", label: "Box A", parentId: "row-a1-1-1" },
  { id: "box-a1-1-2-1", label: "Box B", parentId: "row-a1-1-2" },
  { id: "box-a1-2-1-1", label: "Box C", parentId: "row-a1-2-1" },
  { id: "box-b1-1-1-1", label: "Box D", parentId: "row-b1-1-1" },
];

const slots: NodeOption[] = [
  { id: "slot-a", label: "Slot 1", parentId: "box-a1-1-1-1" },
  { id: "slot-b", label: "Slot 2", parentId: "box-a1-1-1-1" },
  { id: "slot-c", label: "Slot 1", parentId: "box-a1-1-2-1" },
  { id: "slot-d", label: "Slot 1", parentId: "box-a1-2-1-1" },
  { id: "slot-e", label: "Slot 1", parentId: "box-b1-1-1-1" },
];

/** ---------- Statuses ---------- */
const API_STATUSES = [
  "in_store",
  "in_transit",
  "consigned",
  "sold",
  "ebay",
] as const;

const STATUS_LABEL: Record<(typeof API_STATUSES)[number], string> = {
  in_store: "In Store",
  in_transit: "In Transit",
  consigned: "Consigned",
  sold: "Sold",
  ebay: "eBay",
};

const statusIcons: Record<string, JSX.Element> = {
  in_store: <CheckCircle className="h-4 w-4 mr-2 text-[rgb(245,237,49)]" />,
  in_transit: <Truck className="h-4 w-4 mr-2 text-vividOrange" />,
  consigned: <Handshake className="h-4 w-4 mr-2 text-sky-600" />,
  sold: <CheckCircle className="h-4 w-4 mr-2 text-green-600" />,
  ebay: <ExternalLink className="h-4 w-4 mr-2 text-purple-600" />,
};

/** ---------- Props & Form Types ---------- */
export interface AddItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  initialData?: Partial<FormValues>;
}

type FormValues = {
  name: string;
  category: string;
  status: (typeof API_STATUSES)[number];
  price: string;
  description: string;
  thumbnail: string;
  images: Array<{
    source: string;
    front_url?: string;
    rear_url?: string;
    front_thumbnail_url?: string;
    rear_thumbnail_url?: string;
  }>;
  notes: string;
  weight: string;
  weight_unit: "g" | "oz" | "kg" | "lb";

  // Location fields
  siteId?: string;
  roomId?: string;
  shelfId?: string;
  rowId?: string;
  boxId?: string;
  slotId?: string;

  // Coin details
  coin_year: string;
  coin_variety: string;
  coin_fineness: string | null;
  coin_mint_mark: string;
  coin_metal_type: string | null;
  coin_denomination: string;

  // Grade details
  grade_type: string;
  grade_label: string;
  grade_comment: string;
  grade_display: string;
  no_grade_code: string;

  // Metadata
  barcode: string;
  graded_date: string;
  submission_number: string | null;
  encapsulation_date: string;
  cert_number: string;

  // Deprecated - keeping for backward compatibility
  categorySpecifics: Record<string, unknown>;
  categorySpecificsKVs: AttributeKV[];

  date_added: string;
  client_id: string;
};

type AttributeKV = { key: string; value: string };

export function AddItemWizard({
  isOpen,
  onClose,
  onSave,
  initialData,
}: AddItemWizardProps) {
  const { user } = useAuth(); // Get user from auth context
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { toast } = useToast();

  // File upload state
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [rearImage, setRearImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputFrontRef = useRef<HTMLInputElement>(null);
  const fileInputRearRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<{
    front_url?: string;
    rear_url?: string;
    front_thumbnail_url?: string;
    rear_thumbnail_url?: string;
  }>({});

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      category: "Coins",
      status: "in_store",
      price: "",
      description: "",
      thumbnail: "",
      images: [],
      notes: "",
      weight: "0",
      weight_unit: "g",
      categorySpecifics: {
        year: "",
        grade: "",
        mintMark: "",
        metalType: "",
        certNumber: "",
        denomination: "",
      },
      categorySpecificsKVs: [] as AttributeKV[],
      date_added: new Date().toISOString(),
      client_id: "e9f3a0d4-0b71-4728-b131-ec7bc71e902d",
      siteId: undefined,
      roomId: undefined,
      shelfId: undefined,
      rowId: undefined,
      boxId: undefined,
      slotId: undefined,
    },
    mode: "onBlur",
  });

  // ensure client_id is set
  useEffect(() => {
    setValue("client_id", "e9f3a0d4-0b71-4728-b131-ec7bc71e902d");
  }, [setValue]);

  const w = watch();
  const isCoins = w.category === "Coins";

  /** helpers */
  const labelById = (id?: string, list?: NodeOption[]) =>
    id ? list?.find((n) => n.id === id)?.label : undefined;

  const locationPath = useMemo(() => {
    const parts: string[] = [];
    const siteL = labelById(w.siteId, sites);
    const roomL = labelById(w.roomId, rooms);
    const shelfL = labelById(w.shelfId, shelves);
    const rowL = labelById(w.rowId, rows);
    const boxL = labelById(w.boxId, boxes);
    const slotL = labelById(w.slotId, slots);
    if (siteL) parts.push(siteL);
    if (roomL) parts.push(roomL);
    if (shelfL) parts.push(shelfL);
    if (rowL) parts.push(rowL);
    if (boxL) parts.push(boxL);
    if (slotL) parts.push(slotL);
    return parts.join(" > ");
  }, [w.siteId, w.roomId, w.shelfId, w.rowId, w.boxId, w.slotId]);

  const COMMON_ATTRS: Record<string, string[]> = {
    Coins: [
      "year",
      "grade",
      "mintMark",
      "metalType",
      "certNumber",
      "denomination",
    ],
    Stamps: ["year", "grade", "country", "catalogNumber"],
    Cards: ["year", "player", "set", "gradingCompany", "grade"],
    Metals: ["metalType", "purity", "weight", "mint"],
    Bullion: ["metalType", "purity", "weight", "mint"],
    // Gold: ["karat", "weight", "maker"],
    // Silver: ["purity", "weight", "maker"],
    // Diamonds: ["carat", "color", "clarity", "cut", "certificate"],
    Other: [],
  };

  // Normalize to object; last duplicate key wins
  const kvToObject = (kvs: AttributeKV[]) =>
    kvs.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = (key || "").trim();
      if (k) acc[k] = value ?? "";
      return acc;
    }, {});

  /** navigation with validation + toasts */
  const nextStep = async () => {
    if (currentStep === 1) {
      const ok = await trigger(["name", "price", "category", "status"]);
      if (!ok) {
        toast({
          variant: "destructive",
          title: "Missing required fields",
          description: "Please fill Name, Price, Category, and Status.",
        });
        return;
      }
    }

    // Handle image uploads when moving from step 2
    if (currentStep === 2) {
      setIsUploading(true);
      try {
        // Upload front image if selected
        if (frontImage) {
          await uploadImage(frontImage, "front");
        }

        // Upload rear image if selected
        if (rearImage) {
          await uploadImage(rearImage, "rear");
        }
      } catch (error) {
        console.error("Error uploading images:", error);
        toast({
          variant: "destructive",
          title: "Upload error",
          description: "Failed to upload one or more images. Please try again.",
        });
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (currentStep === 3) {
      if (
        !w.siteId ||
        !w.roomId ||
        !w.shelfId ||
        !w.rowId ||
        !w.boxId ||
        !w.slotId
      ) {
        setLocationError("Please select Site, Room, Shelf, Row, Box and Slot.");
        toast({
          variant: "destructive",
          title: "Location incomplete",
          description: "Select Site → Room → Shelf → Row → Box → Slot.",
        });
        return;
      }
      setLocationError(null);
    }

    setCurrentStep((s) => Math.min(4, s + 1));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1));

  const resetForm = () => {
    const defaultValues: Partial<FormValues> = {
      name: "",
      category: "Coins",
      status: "in_store",
      price: "",
      description: "",
      thumbnail: "",
      images: [],
      notes: "",
      weight: "0",
      weight_unit: "g",
      coin_year: "",
      coin_variety: "",
      coin_fineness: null,
      coin_mint_mark: "",
      coin_metal_type: null,
      coin_denomination: "",
      grade_type: "N",
      grade_label: "",
      grade_comment: "",
      grade_display: "GENUINE",
      no_grade_code: "",
      barcode: "",
      graded_date: "",
      submission_number: null,
      encapsulation_date: "",
      cert_number: "",
      categorySpecifics: {},
      categorySpecificsKVs: [] as AttributeKV[],
      date_added: new Date().toISOString(),
      client_id: "e9f3a0d4-0b71-4728-b131-ec7bc71e902d",
      siteId: undefined,
      roomId: undefined,
      shelfId: undefined,
      rowId: undefined,
      boxId: undefined,
      slotId: undefined,
    };
    reset(defaultValues);

    // Reset image states
    setFrontImage(null);
    setRearImage(null);
    setUploadedImages({});
    setUploadProgress(0);

    // Reset file inputs
    if (fileInputFrontRef.current) fileInputFrontRef.current.value = "";
    if (fileInputRearRef.current) fileInputRearRef.current.value = "";

    setCurrentStep(1);
    setFatalError(null);
    setLocationError(null);
  };

  /** submit with toasts */
  const onSubmitRHF = handleSubmit(async (values) => {
    if (currentStep !== 4) return;

    if (
      !values.siteId ||
      !values.roomId ||
      !values.shelfId ||
      !values.rowId ||
      !values.boxId ||
      !values.slotId
    ) {
      setLocationError("Please select Site, Room, Shelf, Row, Box and Slot.");
      toast({
        variant: "destructive",
        title: "Location incomplete",
        description: "Select Site → Room → Shelf → Row → Box → Slot.",
      });
      return;
    }

    try {
      setIsLoading(true);
      setFatalError(null);

      // Prepare image data in the required format
      const imageData = {
        source: "gcs",
        front_url: uploadedImages.front_url || "",
        rear_url: uploadedImages.rear_url || "",
        front_thumbnail_url: uploadedImages.front_thumbnail_url || "",
        rear_thumbnail_url: uploadedImages.rear_thumbnail_url || "",
      };

      const apiData = {
        name: values.name,
        description: values.description || "",
        status: values.status,
        price: values.price ? values.price.toString() : "0",
        thumbnail: uploadedImages.front_thumbnail_url || "",
        images: [imageData],
        notes: values.notes || "",
        is_consigned: false,
        weight: values.weight ? values.weight.toString() : "0",
        weight_unit: values.weight_unit || "g",
        created_by: user?.id || null, // Add the user ID as created_by
        attributes: {
          coin: {
            year: values.coin_year || "",
            variety: values.coin_variety || "",
            fineness: values.coin_fineness || null,
            mint_mark: values.coin_mint_mark || "",
            metal_type: values.coin_metal_type || null,
            denomination: values.coin_denomination || "",
          },
          grade: {
            type: values.grade_type || "N",
            label: values.grade_label || "",
            comment: values.grade_comment || "",
            display: values.grade_display || "GENUINE",
            service: "NON-NGC",
            no_grade_code: values.no_grade_code || "",
          },
          metadata: {
            barcode: values.barcode || "",
            graded_date: values.graded_date || "",
            submission_number: values.submission_number || null,
            encapsulation_date: values.encapsulation_date || "",
          },
          cert_number: values.cert_number || "",
          lookup_url: null,
        },
        client_id: values.client_id,
        category: values.category,
        date_added: values.date_added,
        location_path: locationPath,
        location: locationPath,
      };

      console.log("Submitting item with data:", apiData);

      const newItem = await inventoryApi.createItem(
        apiData as Omit<InventoryItem, "id">,
        user?.id, // Pass user ID to the API service
      );

      toast({
        title: "Item created",
        description: `"${values.name}" was added to inventory.`,
      });

      onSave(newItem);
      onClose();
      resetForm();
    } catch (err: any) {
      let message = "Failed to create item. Please try again.";
      if (err?.response?.data) {
        const errorData = err.response.data;
        message =
          typeof errorData === "object"
            ? Object.entries(errorData)
                .map(
                  ([f, e]: any) =>
                    `${f}: ${Array.isArray(e) ? e.join(", ") : e}`,
                )
                .join("\n")
            : err.response.data?.detail || message;
      }
      setFatalError(message);
      toast({
        variant: "destructive",
        title: "Could not create item",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  });

  /** step indicator */
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {["Basic Info", "Images", "Details", "Review"].map((label, index) => {
        const step = index + 1;
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 z-10 ${
                  isActive
                    ? "bg-[rgb(245,237,49)] text-black"
                    : isCompleted
                      ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                      : "bg-white/10 text-moss-600 border border-white/20"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{step}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium text-center ${
                  isActive ? "text-sky-600" : "text-moss-600"
                }`}
              >
                {label}
              </span>
            </div>
            {step < 4 && (
              <div
                className={`h-0.5 w-12 mx-3 ${
                  isCompleted
                    ? "bg-gradient-to-r from-green-500 to-emerald-600"
                    : "bg-white/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  /** ---------- Steps ---------- */

  const Step1 = (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-sky-200/60 mb-6 bg-white">
        <h3 className="text-xl font-semibold text-sky-500 mb-6 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Item Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., 1oz Gold Maple Leaf Coin"
              {...register("name", { required: "Item name is required" })}
            />
            {errors.name && (
              <p className="text-red-600 text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Category <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="category"
              rules={{ required: "Category is required" }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "Coins", label: "Coins" },
                      { value: "Stamps", label: "Stamps" },
                      { value: "Cards", label: "Trading Cards" },
                      { value: "Metals", label: "Precious Metals" },
                      { value: "Bullion", label: "Bullion" },
                      { value: "Gold", label: "Gold Items" },
                      { value: "Silver", label: "Silver Items" },
                      { value: "Diamonds", label: "Diamonds" },
                      { value: "Other", label: "Other Collectibles" },
                    ].map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <p className="text-red-600 text-sm">
                {String(errors.category.message)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-medium">
              Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600">
                $
              </span>
              <Input
                id="price"
                type="number"
                step="0.01"
                className="pl-8"
                placeholder="0.00"
                {...register("price", {
                  required: "Price is required",
                  validate: (v) =>
                    parseFloat(v || "0") >= 0.01 || "Must be at least $0.01",
                })}
              />
            </div>
            {errors.price && (
              <p className="text-red-600 text-sm">{errors.price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Status
            </Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {API_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center">
                          {statusIcons[s]}
                          {STATUS_LABEL[s]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed description of the item..."
              {...register("description")}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Handle file selection and upload
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "front" | "rear",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid image file (JPEG, PNG, WebP, GIF)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload the file to GCS
      const result = await uploadImage(file, type);

      if (!result) {
        throw new Error("Failed to upload image");
      }

      toast({
        title: "Upload successful",
        description: "Image was uploaded successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Error handling file upload:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle image upload to GCS
  const uploadImage = async (file: File, type: "front" | "rear") => {
    if (!file) return null;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      // Add any additional metadata if needed
      const metadata = {
        originalName: file.name,
        size: file.size.toString(),
        type: file.type,
      };
      formData.append("metadata", JSON.stringify(metadata));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { url, thumbnailUrl } = await response.json();

      // Update the uploaded images state
      setUploadedImages((prev) => ({
        ...prev,
        [`${type}_url`]: url,
        [`${type}_thumbnail_url`]: thumbnailUrl || url, // Fallback to url if thumbnail not available
      }));

      return { url, thumbnailUrl: thumbnailUrl || url };
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle image removal
  const removeImage = (type: "front" | "rear") => {
    if (type === "front") {
      setFrontImage(null);
      setUploadedImages((prev) => ({
        ...prev,
        front_url: undefined,
        front_thumbnail_url: undefined,
      }));
    } else {
      setRearImage(null);
      setUploadedImages((prev) => ({
        ...prev,
        rear_url: undefined,
        rear_thumbnail_url: undefined,
      }));
    }
  };

  const Step2 = (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-sky-200/60 mb-6 bg-white">
        <h3 className="text-xl font-semibold text-sky-700 mb-6 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Images & Media
        </h3>

        <div className="space-y-6">
          {/* Front Image Upload */}
          <div>
            <Label className="block text-sm font-medium mb-2">
              Front Image
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {uploadedImages.front_url ? (
                <div className="relative group">
                  <img
                    src={uploadedImages.front_url}
                    alt="Front of item"
                    className="mx-auto max-h-48 rounded-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage("front")}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-full inline-block">
                    <UploadIcon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span
                        className="font-medium text-sky-700 cursor-pointer hover:underline"
                        onClick={() => fileInputFrontRef.current?.click()}
                      >
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      SVG, PNG, JPG or GIF (max. 10MB)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputFrontRef.current?.click()}
                    disabled={isUploading}
                  >
                    Select File
                  </Button>
                  <input
                    type="file"
                    ref={fileInputFrontRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "front")}
                    disabled={isUploading}
                  />
                </div>
              )}
              {isUploading && frontImage && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    Uploading {frontImage.name}...
                  </p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>

          {/* Rear Image Upload */}
          <div>
            <Label className="block text-sm font-medium mb-2">
              Rear Image (Optional)
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {uploadedImages.rear_url ? (
                <div className="relative group">
                  <img
                    src={uploadedImages.rear_url}
                    alt="Rear of item"
                    className="mx-auto max-h-48 rounded-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage("rear")}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-full inline-block">
                    <UploadIcon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span
                        className="font-medium text-sky-700 cursor-pointer hover:underline"
                        onClick={() => fileInputRearRef.current?.click()}
                      >
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      SVG, PNG, JPG or GIF (max. 10MB)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRearRef.current?.click()}
                    disabled={isUploading}
                  >
                    Select File
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRearRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "rear")}
                    disabled={isUploading}
                  />
                </div>
              )}
              {isUploading && rearImage && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    Uploading {rearImage.name}...
                  </p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const Step3 = (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-sky-200/60 mb-6 bg-white">
        <h3 className="text-xl font-semibold text-sky-700 mb-4 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Details & Location
        </h3>

        {/* Weight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium">
              Weight
            </Label>
            <div className="flex">
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.01"
                className="rounded-r-none"
                placeholder="0.00"
                {...register("weight")}
              />
              <Controller
                control={control}
                name="weight_unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-24 rounded-l-none border-l-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>
        <br />
        {/* Category-specific attributes (dynamic) */}
        <div className="space-y-6 mt-4">
          {/* Coin Details Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-base font-semibold text-sky-700">
              Coin Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coin_year" className="text-sm font-medium">
                  Year
                </Label>
                <Input
                  id="coin_year"
                  placeholder="e.g., 1808"
                  {...register("coin_year")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coin_variety" className="text-sm font-medium">
                  Variety
                </Label>
                <Input
                  id="coin_variety"
                  placeholder="e.g., MADRAS PRESIDENCY (4.7g)"
                  {...register("coin_variety")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coin_mint_mark" className="text-sm font-medium">
                  Mint Mark
                </Label>
                <Input
                  id="coin_mint_mark"
                  placeholder="e.g., INDIA"
                  {...register("coin_mint_mark")}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="coin_denomination"
                  className="text-sm font-medium"
                >
                  Denomination
                </Label>
                <Input
                  id="coin_denomination"
                  placeholder="e.g., 10CASH"
                  {...register("coin_denomination")}
                />
              </div>
            </div>
          </div>

          {/* Grade Information Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-base font-semibold text-sky-700">
              Grade Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade_display" className="text-sm font-medium">
                  Grade
                </Label>
                <Input
                  id="grade_display"
                  placeholder="e.g., GENUINE"
                  {...register("grade_display")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade_type" className="text-sm font-medium">
                  Type
                </Label>
                <Input
                  id="grade_type"
                  placeholder="e.g., N"
                  {...register("grade_type")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_grade_code" className="text-sm font-medium">
                  No Grade Code
                </Label>
                <Input
                  id="no_grade_code"
                  placeholder="e.g., AG"
                  {...register("no_grade_code")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade_comment" className="text-sm font-medium">
                  Comment
                </Label>
                <Input
                  id="grade_comment"
                  placeholder="Optional comment"
                  {...register("grade_comment")}
                />
              </div>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-base font-semibold text-sky-700">Metadata</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barcode" className="text-sm font-medium">
                  Barcode
                </Label>
                <Input
                  id="barcode"
                  placeholder="e.g., 75131300028344653324"
                  {...register("barcode")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert_number" className="text-sm font-medium">
                  Certificate Number
                </Label>
                <Input
                  id="cert_number"
                  placeholder="e.g., 8344653-324"
                  {...register("cert_number")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graded_date" className="text-sm font-medium">
                  Graded Date
                </Label>
                <Input
                  id="graded_date"
                  type="date"
                  {...register("graded_date")}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="encapsulation_date"
                  className="text-sm font-medium"
                >
                  Encapsulation Date
                </Label>
                <Input
                  id="encapsulation_date"
                  type="date"
                  {...register("encapsulation_date")}
                />
              </div>
            </div>
          </div>

          {/* Legacy Attributes Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
            <h4 className="text-base font-semibold text-slate-700">
              Legacy Attributes (Deprecated)
            </h4>
            <p className="text-sm text-slate-600">
              These fields are kept for backward compatibility. Please use the
              dedicated fields above for new entries.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-sky-700">
              Attributes (optional)
            </h4>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const list = [...(w.categorySpecificsKVs || [])];
                  list.push({ key: "", value: "" });
                  setValue("categorySpecificsKVs", list, { shouldDirty: true });
                }}
              >
                + Add row
              </Button>
              {/* Quick-add chips for current category */}
              {(COMMON_ATTRS[w.category] || []).slice(0, 5).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => {
                    const list = [...(w.categorySpecificsKVs || [])];
                    list.push({ key: preset, value: "" });
                    setValue("categorySpecificsKVs", list, {
                      shouldDirty: true,
                    });
                  }}
                >
                  + {preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {(w.categorySpecificsKVs || []).map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-center rounded-md border p-2 bg-white"
              >
                <div className="col-span-4">
                  <Input
                    placeholder="key (e.g., year)"
                    value={row.key}
                    onChange={(e) => {
                      const list = [...(w.categorySpecificsKVs || [])];
                      list[idx] = { ...list[idx], key: e.target.value };
                      setValue("categorySpecificsKVs", list, {
                        shouldDirty: true,
                      });
                    }}
                  />
                </div>
                <div className="col-span-7">
                  <Input
                    placeholder="value (e.g., 1851)"
                    value={row.value}
                    onChange={(e) => {
                      const list = [...(w.categorySpecificsKVs || [])];
                      list[idx] = { ...list[idx], value: e.target.value };
                      setValue("categorySpecificsKVs", list, {
                        shouldDirty: true,
                      });
                    }}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const list = [...(w.categorySpecificsKVs || [])];
                      list.splice(idx, 1);
                      setValue("categorySpecificsKVs", list, {
                        shouldDirty: true,
                      });
                    }}
                    aria-label="Remove row"
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* hint / validation */}
          {Array.isArray(w.categorySpecificsKVs) &&
            w.categorySpecificsKVs.some((r: AttributeKV) => !r.key?.trim()) && (
              <p className="text-xs text-red-600">
                Rows with an empty <strong>key</strong> will be ignored on save.
              </p>
            )}
        </div>
        <br />
        {/* Location selectors */}
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Select the location (Site → Room → Shelf → Row → Box → Slot). We’ll
            send the full path to the API.
          </p>

          {/* Site / Room / Shelf */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Site</Label>
              <Controller
                control={control}
                name="siteId"
                rules={{ required: "Site is required" }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("roomId", undefined);
                      setValue("shelfId", undefined);
                      setValue("rowId", undefined);
                      setValue("boxId", undefined);
                      setValue("slotId", undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.siteId && (
                <p className="text-red-600 text-sm">
                  {String(errors.siteId.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Room</Label>
              <Controller
                control={control}
                name="roomId"
                rules={{ required: "Room is required" }}
                render={({ field }) => {
                  const filtered = rooms.filter((r) => r.parentId === w.siteId);
                  return (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue("shelfId", undefined);
                        setValue("rowId", undefined);
                        setValue("boxId", undefined);
                        setValue("slotId", undefined);
                      }}
                      disabled={!w.siteId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {filtered.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.roomId && (
                <p className="text-red-600 text-sm">
                  {String(errors.roomId.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Shelf</Label>
              <Controller
                control={control}
                name="shelfId"
                rules={{ required: "Shelf is required" }}
                render={({ field }) => {
                  const filtered = shelves.filter(
                    (s) => s.parentId === w.roomId,
                  );
                  return (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue("rowId", undefined);
                        setValue("boxId", undefined);
                        setValue("slotId", undefined);
                      }}
                      disabled={!w.roomId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shelf" />
                      </SelectTrigger>
                      <SelectContent>
                        {filtered.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.shelfId && (
                <p className="text-red-600 text-sm">
                  {String(errors.shelfId.message)}
                </p>
              )}
            </div>
          </div>

          {/* Row / Box / Slot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Row</Label>
              <Controller
                control={control}
                name="rowId"
                rules={{ required: "Row is required" }}
                render={({ field }) => {
                  const filtered = rows.filter((r) => r.parentId === w.shelfId);
                  return (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue("boxId", undefined);
                        setValue("slotId", undefined);
                      }}
                      disabled={!w.shelfId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select row" />
                      </SelectTrigger>
                      <SelectContent>
                        {filtered.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.rowId && (
                <p className="text-red-600 text-sm">
                  {String(errors.rowId.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Box</Label>
              <Controller
                control={control}
                name="boxId"
                rules={{ required: "Box is required" }}
                render={({ field }) => {
                  const filtered = boxes.filter((b) => b.parentId === w.rowId);
                  return (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue("slotId", undefined);
                      }}
                      disabled={!w.rowId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select box" />
                      </SelectTrigger>
                      <SelectContent>
                        {filtered.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.boxId && (
                <p className="text-red-600 text-sm">
                  {String(errors.boxId.message)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Slot</Label>
              <Controller
                control={control}
                name="slotId"
                rules={{ required: "Slot is required" }}
                render={({ field }) => {
                  const filtered = slots.filter((s) => s.parentId === w.boxId);
                  return (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!w.boxId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {filtered.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.slotId && (
                <p className="text-red-600 text-sm">
                  {String(errors.slotId.message)}
                </p>
              )}
            </div>
          </div>

          {/* Computed location path preview */}
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">Location path: </span>
              {locationPath || (
                <span className="text-red-600">Not complete</span>
              )}
            </p>
            {locationError && (
              <div className="mt-3 p-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm">
                {locationError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const Step4 = (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-sky-200/60 mb-6 bg-white">
        <h3 className="text-xl font-semibold text-sky-700 mb-6 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Review & Submit
        </h3>
        <div className="p-6 space-y-6 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Item Name</p>
              <p className="font-medium">{w.name || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Category</p>
              <p className="font-medium">{w.category}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium">{STATUS_LABEL[w.status]}</p>
            </div>
            <div>
              <p className="text-gray-500">Price</p>
              <p className="font-semibold">
                ${parseFloat(w.price || "0").toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Weight Unit</p>
              <p className="font-medium">{w.weight_unit}</p>
            </div>
            <div>
              <p className="text-gray-500">Weight</p>
              <p className="font-medium">
                {parseFloat(w.weight || "0").toFixed(2)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Location Path</p>
              <p className="font-medium">{locationPath || "-"}</p>
            </div>
          </div>

          <div className="col-span-2">
            <p className="text-gray-500">Attributes</p>
            {(() => {
              const obj = kvToObject(w.categorySpecificsKVs || []);
              const keys = Object.keys(obj);
              if (keys.length === 0)
                return <p className="text-sm text-gray-700">—</p>;
              return (
                <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {keys.map((k) => (
                    <div key={k}>
                      <span className="text-gray-500">{k}: </span>
                      <span className="font-medium">
                        {String(obj[k] ?? "-")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {w.description && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-gray-800">{w.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="notes" className="text-sm font-medium">
            Additional Notes
          </Label>
          <Textarea
            id="notes"
            placeholder="Any additional notes or details..."
            {...register("notes")}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          resetForm();
        }
      }}
    >
      <DialogContent
        className="p-0 overflow-hidden max-w-4xl max-h-[90vh] flex flex-col font-urbanist"
        aria-describedby="wizard-description"
      >
        <div className="p-6 bg-sky-400 rounded-t-xl">
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-2xl font-medium text-black">
              Add New Inventory Item
            </DialogTitle>
          </div>
          <p id="wizard-description" className="text-sm text-black/90">
            {currentStep === 1 && "Enter basic information about your item"}
            {currentStep === 2 && "Upload images to showcase your item"}
            {currentStep === 3 && "Add detailed specifications and location"}
            {currentStep === 4 && "Review and confirm your item details"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {renderStepIndicator()}
          <form
            onSubmit={onSubmitRHF}
            className="space-y-6 flex flex-col h-full"
          >
            {currentStep === 1 && Step1}
            {currentStep === 2 && Step2}
            {currentStep === 3 && Step3}
            {currentStep === 4 && Step4}

            <div className="flex justify-between pt-4 border-t border-lightBorder mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="border-lightBorder text-ink hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex items-center gap-3">
                {currentStep < 4 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        resetForm();
                      }}
                      className="border-lightBorder text-ink hover:bg-gray-50 hover:border-gray-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="bg-sky-600 border border-sky-700 text-white hover:bg-sky-700 hover:border-sky-800 shadow-sm transition-all duration-200 group"
                    >
                      Next Step
                      <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="border-lightBorder text-ink hover:bg-gray-50 hover:border-gray-300"
                    >
                      Back
                    </Button>
                    {fatalError && (
                      <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md mb-3 max-w-sm">
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {fatalError}
                        </pre>
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={isLoading || isSubmitting}
                      className="bg-sky-600 border border-sky-700 text-white hover:bg-sky-700 hover:border-sky-800 shadow-sm transition-all duration-200 flex items-center"
                    >
                      {isLoading || isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Item
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
