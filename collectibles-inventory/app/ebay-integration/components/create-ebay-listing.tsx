"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Eye,
  DollarSign,
  Calendar,
  Truck,
  RotateCcw,
  Package,
  Hash,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GlassContainer } from "@/components/app-layout";
import type { InventoryItem, ListingTemplate } from "../types/ebay";
import { inventoryApi } from "../../inventory-management/services/api";
import { useToast } from "@/components/ui/use-toast";
import { ebayApi, type EbayListingPayload } from "../services/ebayApi";
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

// eBay Category Mapping
const EBAY_CATEGORIES = [
  { id: "102504", name: "Coins & Paper Money:Coins:US" },
  { id: "39482", name: "Coins & Paper Money:Coins:World" },
  { id: "11116", name: "Coins & Paper Money:Bullion:Bars" },
  { id: "45145", name: "Coins & Paper Money:Bullion:Rounds" },
  { id: "11730", name: "Trading Cards:Sports Cards" },
  { id: "183454", name: "Trading Cards:Pokémon" },
  { id: "1", name: "Collectibles" },
];

// eBay Duration Mapping
const EBAY_DURATIONS = [
  { value: "GTC", label: "Good 'Til Cancelled" },
  { value: "3", label: "3 days" },
  { value: "5", label: "5 days" },
  { value: "7", label: "7 days" },
  { value: "10", label: "10 days" },
  { value: "30", label: "30 days" },
];

// Business Policies Mapping (from your eBay service)
const BUSINESS_POLICIES = {
  shipping: [
    { id: "6211285000", name: "Standard Shipping - $9.99" },
    { id: "flat_rate_5", name: "Flat Rate - $5.99" },
    { id: "free_shipping", name: "Free Shipping" },
    { id: "calculated", name: "Calculated Shipping" },
  ],
  returns: [
    { id: "6211299000", name: "30 Days Returns" },
    { id: "14_days", name: "14 Days Returns" },
    { id: "no_returns", name: "No Returns" },
  ],
};

export function CreateEbayListing() {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ListingTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [listingResult, setListingResult] = useState<any>(null);
  const { toast } = useToast();

  // NEW: 2-Step Mode State
  const [listingMode, setListingMode] = useState<"create" | "update">("create");
  const [existingListing, setExistingListing] = useState<any>(null);
  const [isCheckingListing, setIsCheckingListing] = useState(false);

  const listingTemplates: ListingTemplate[] = [
    {
      id: "1",
      name: "Standard Coin Listing",
      category: "Coins",
      description: "Professional coin listing template",
      preview: "High-quality images with detailed grading information",
    },
    {
      id: "2",
      name: "Premium Collectible",
      category: "All",
      description: "Premium template for high-value items",
      preview: "Elegant layout with enhanced description sections",
    },
  ];

  const [listingData, setListingData] = useState({
    sku: "",
    title: "",
    category: "102504",
    duration: "GTC",
    startingPrice: "",
    buyItNowPrice: "",
    shippingPolicy: "6211285000",
    returnPolicy: "6211299000",
    description: "",
    quantity: "1",
  });

  // Fetch real inventory data
  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // NEW: 2-Step Mode Detection
  useEffect(() => {
    const checkListingMode = async () => {
      if (selectedItem) {
        setIsCheckingListing(true);

        try {
          const sku = generateSku(selectedItem);
          if (sku) {
            const result = await ebayApi.getListingBySku(sku);
            if (result.exists) {
              setListingMode("update");
              setExistingListing(result.listing);
              console.log(
                "✅ UPDATE MODE: Found existing eBay listing",
                result.listing,
              );
            } else {
              setListingMode("create");
              setExistingListing(null);
              console.log("✅ CREATE MODE: No existing eBay listing found");
            }
          } else {
            setListingMode("create");
            setExistingListing(null);
          }
        } catch (error) {
          console.error("Error checking eBay listing:", error);
          setListingMode("create");
          setExistingListing(null);
        } finally {
          setIsCheckingListing(false);
        }
      }
    };

    checkListingMode();
  }, [selectedItem]);

  const fetchInventoryItems = async () => {
    setIsLoading(true);
    try {
      const response = await inventoryApi.getItems({
        page: 1,
        page_size: 100,
        is_listed: false,
      });

      const itemsWithDisplay: InventoryItem[] = response.results.map(
        (item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          category: item.category,
          status: item.status,
          price:
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price,
          thumbnail: extractAllImageUrls(item.images)[0] || "", // First image as thumbnail
          images: item.images || [],
          attributes: item.attributes || {},
          is_listed: item.is_listed || false,
        }),
      );

      setInventoryItems(itemsWithDisplay);
    } catch (error) {
      console.error("Failed to fetch inventory items:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory items",
        variant: "destructive",
      });
      setInventoryItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // WITH this new function:
  const extractAllImageUrls = (images: any[] | undefined): string[] => {
    if (!images || images.length === 0) return [];

    const urls: string[] = [];

    images.forEach((img) => {
      if (typeof File !== "undefined" && img instanceof File) {
        try {
          urls.push(URL.createObjectURL(img));
        } catch {
          // Skip invalid files
        }
      } else if (typeof img === "string") {
        urls.push(img);
      } else {
        // Handle object with multiple URL properties
        if (img.front_url) urls.push(img.front_url);
        if (img.rear_url) urls.push(img.rear_url);
        if (img.url) urls.push(img.url);
      }
    });

    console.log("📸 Extracted image URLs:", urls);
    return urls.filter((url) => url && url.trim() !== "");
  };

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Auto-generate eBay data when item is selected - UPDATED for 2-step mode
  useEffect(() => {
    if (selectedItem) {
      const title = generateEbayTitle(selectedItem);
      const sku = generateSku(selectedItem);

      // For UPDATE mode, use inventory price, not eBay price
      const startingPrice = selectedItem.price.toString(); // ✅ Always use inventory price

      // Buy It Now price is exactly 10% above starting price (no rounding)
      const buyItNowPrice = (parseFloat(startingPrice) * 1.1).toString();

      setListingData((prev) => ({
        ...prev,
        sku,
        title,
        startingPrice: startingPrice, // ✅ Always use inventory price
        buyItNowPrice: buyItNowPrice, // ✅ No rounding
        description: selectedItem.description,
        quantity: "1",
      }));
    }
  }, [selectedItem, listingMode, existingListing]);

  const generateEbayTitle = (item: InventoryItem): string => {
    let title = item.name;
    if (title.length > 75) {
      title = title.substring(0, 72) + "...";
    }
    return title;
  };

  // const generateSku = (item: InventoryItem): string => {
  //   const timestamp = Date.now().toString().slice(-4)
  //   return `${item.id}-${timestamp}`
  // }
  const generateSku = (item: InventoryItem): string => {
    return item.attributes?.cert_number || "";
  };

  const getTemplatesByCategory = (category: string) => {
    return listingTemplates.filter(
      (template) =>
        template.category === category || template.category === "All",
    );
  };

  const handleItemSelect = (item: InventoryItem) => {
    setSelectedItem(item);
    const categoryTemplates = getTemplatesByCategory(item.category);
    if (categoryTemplates.length > 0) {
      setSelectedTemplate(categoryTemplates[0]);
    }
  };
  //create listing
  const handleCreateListing = async () => {
    if (!selectedItem || isCreatingListing) return;

    setIsCreatingListing(true);
    try {
      // ✅ FIX: Use the new function to get ALL image URLs
      const imageUrls = extractAllImageUrls(selectedItem.images || []);

      console.log("📸 All extracted image URLs:", imageUrls);

      const aspects = transformAttributes(selectedItem.attributes || {});

      const price = parseFloat(listingData.startingPrice) || 0.01;
      if (price <= 0) {
        throw new Error("Price must be greater than 0");
      }

      const ebayPayload: EbayListingPayload = {
        sku: listingData.sku,
        title: listingData.title,
        description: listingData.description,
        price: price,
        quantity: parseInt(listingData.quantity) || 1,
        category_id: listingData.category,
        image_urls: imageUrls, // ✅ Now contains ALL image URLs
        aspects: aspects,
        currency: "USD",
        listing_duration: listingData.duration,
        inventory_item_id: selectedItem.id,
      };

      console.log("Creating eBay listing with payload:", ebayPayload);

      const result = await ebayApi.createListing(ebayPayload);
      console.log("🎯 CREATE API RESPONSE:", {
        success: result.success,
        listing_id: result.listing_id,
        listing_url: result.listing_url,
        offer_id: result.offer_id,
        fullResponse: result,
      });

      if (result.success) {
        setListingResult(result);
        setShowSuccessDialog(true);

        console.log("Listing created:", {
          listingId: result.listing_id,
          offerId: result.offer_id,
          url: result.listing_url,
        });
      } else {
        throw new Error(result.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Failed to create eBay listing:", error);

      let errorMessage = "There was an error creating your eBay listing.";
      if (error instanceof Error) {
        if (
          error.message.includes("duplicate") ||
          error.message.includes("already have")
        ) {
          errorMessage =
            "This item appears to already be listed on eBay. Please check for duplicates.";
        } else if (error.message.includes("category")) {
          errorMessage =
            "There was an issue with the selected category. Please try a different one.";
        } else if (error.message.includes("image")) {
          errorMessage =
            "There was an issue with the images. Please check they are accessible URLs.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Listing Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingListing(false);
    }
  };

  // NEW: Handle Update Listing
  const handleUpdateListing = async () => {
    if (!selectedItem || !existingListing || isCreatingListing) return;

    setIsCreatingListing(true);
    try {
      const price = parseFloat(listingData.startingPrice) || 0.01; // ✅ Exact inventory price
      if (price <= 0) {
        throw new Error("Price must be greater than 0");
      }

      // Call UPDATE endpoint
      const result = await ebayApi.updateListing({
        offer_id: existingListing.offer_id,
        new_price: price, // ✅ Exact value
        new_quantity: parseInt(listingData.quantity) || 1,
      });

      if (result.success) {
        setListingResult(result);
        setShowSuccessDialog(true);

        console.log("Listing updated:", {
          listingId: existingListing.listing_id,
          offerId: existingListing.offer_id,
          url: existingListing.listing_url,
        });
      } else {
        throw new Error(result.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Failed to update eBay listing:", error);

      let errorMessage = "There was an error updating your eBay listing.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingListing(false);
    }
  };

  const transformAttributes = (attributes: Record<string, any>) => {
    if (!attributes || Object.keys(attributes).length === 0) return {};

    const aspects: Record<string, string[]> = {};

    if (attributes.grade) {
      if (attributes.grade.service)
        aspects["Certification"] = [attributes.grade.service];
      if (attributes.grade.label) aspects["Grade"] = [attributes.grade.label];
      if (attributes.grade.display)
        aspects["Grade Description"] = [attributes.grade.display];
      if (attributes.grade.comment)
        aspects["Comments"] = [attributes.grade.comment];
    }

    if (attributes.coin) {
      if (attributes.coin.year)
        aspects["Year"] = [String(attributes.coin.year)];
      if (attributes.coin.mint_mark)
        aspects["Mint Mark"] = [attributes.coin.mint_mark];
      if (attributes.coin.denomination)
        aspects["Denomination"] = [attributes.coin.denomination];
      if (attributes.coin.variety)
        aspects["Variety"] = [attributes.coin.variety];
      if (attributes.coin.metal_type)
        aspects["Metal Type"] = [attributes.coin.metal_type];
      if (attributes.coin.fineness)
        aspects["Fineness"] = [String(attributes.coin.fineness)];
    }

    if (attributes.cert_number)
      aspects["Certification Number"] = [attributes.cert_number];
    if (attributes.year) aspects["Year"] = [String(attributes.year)];
    if (attributes.mint_mark) aspects["Mint Mark"] = [attributes.mint_mark];
    if (attributes.denomination)
      aspects["Denomination"] = [attributes.denomination];
    if (attributes.variety) aspects["Variety"] = [attributes.variety];
    if (attributes.metal_type) aspects["Metal Type"] = [attributes.metal_type];

    if (attributes.metadata) {
      if (attributes.metadata.encapsulation_date)
        aspects["Encapsulation Date"] = [
          attributes.metadata.encapsulation_date,
        ];
      if (attributes.metadata.graded_date)
        aspects["Graded Date"] = [attributes.metadata.graded_date];
    }

    console.log("Transformed eBay aspects:", aspects);
    return aspects;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header - UPDATED for 2-step mode */}
      <GlassContainer className="p-6 rounded-xl">
        <h2 className="text-2xl font-urbanist font-semibold text-ink mb-2">
          {listingMode === "create"
            ? "Create eBay Listing"
            : "Update eBay Listing"}
        </h2>
        <p className="text-moss-600 font-urbanist">
          {listingMode === "create"
            ? "Select an inventory item and configure your eBay listing"
            : "Update your existing eBay listing with new price and quantity"}
          {isCheckingListing && " (Checking eBay status...)"}
        </p>
        {listingMode === "update" && existingListing && (
          <Badge className="mt-2 bg-sky-100 text-sky-800 border-sky-200">
            Update Mode - Item already listed on eBay
          </Badge>
        )}
      </GlassContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Item Selection */}
        <div className="space-y-6">
          {/* Item Search */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-ink font-urbanist text-xl">
                Select from Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-goldYellow/70 h-4 w-4" />
                <Input
                  placeholder="Search inventory items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                />
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-goldYellow mx-auto"></div>
                    <p className="text-moss-600 mt-2 font-urbanist">
                      Loading inventory...
                    </p>
                  </div>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-300 ${
                        selectedItem?.id === item.id
                          ? "border-goldYellow/50 bg-white/30 shadow-md"
                          : "border-gray-200/50 hover:border-goldYellow/30 hover:bg-white/20"
                      }`}
                      onClick={() => handleItemSelect(item)}
                    >
                      <img
                        src={item.thumbnail || "/placeholder.svg"}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded border border-goldYellow/20"
                      />
                      <div className="flex-1">
                        <h4 className="font-urbanist text-sm text-ink">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs bg-white/10 border-goldYellow/30 text-moss-600"
                          >
                            {item.category}
                          </Badge>
                          <span className="text-sm font-urbanist text-vividOrange">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-moss-600 font-urbanist">
                    No inventory items found.{" "}
                    {searchTerm && "Try adjusting your search."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          {selectedItem && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-ink font-urbanist text-xl">
                  Listing Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedTemplate?.id || ""}
                  onValueChange={(value) => {
                    const template = listingTemplates.find(
                      (t) => t.id === value,
                    );
                    setSelectedTemplate(template || null);
                  }}
                >
                  <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                    {getTemplatesByCategory(selectedItem.category).map(
                      (template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id}
                          className="focus:bg-goldYellow/20 focus:text-ink"
                        >
                          <div>
                            <div className="font-urbanist text-ink">
                              {template.name}
                            </div>
                            <div className="text-sm text-moss-600 font-urbanist">
                              {template.description}
                            </div>
                          </div>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>

                {selectedTemplate && (
                  <GlassContainer className="mt-3 p-3 rounded-lg">
                    <p className="text-sm text-moss-600 font-urbanist">
                      {selectedTemplate.preview}
                    </p>
                  </GlassContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Listing Preview */}
        <div className="space-y-6">
          {selectedItem ? (
            <>
              {/* Preview */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-ink font-urbanist text-xl">
                    <Eye className="h-5 w-5 text-goldYellow/80" />
                    Listing Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Multiple Images Preview */}
                    <div className="grid grid-cols-2 gap-2">
                      {extractAllImageUrls(selectedItem.images || [])
                        .slice(0, 4)
                        .map((imgUrl, index) => (
                          <div
                            key={index}
                            className="relative rounded-lg overflow-hidden border border-goldYellow/30 shadow-md"
                          >
                            <img
                              src={imgUrl || "/placeholder.svg"}
                              alt={`${selectedItem.name} - Image ${index + 1}`}
                              className="w-full h-32 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/10"></div>
                            {index === 0 && (
                              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                Primary
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    <div>
                      <h3 className="font-urbanist font-semibold text-lg text-ink">
                        {listingData.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-white/10 border border-goldYellow/30 text-ink hover:bg-white/20">
                          {selectedItem.category}
                        </Badge>
                        <span className="text-sm text-moss-600">
                          • {selectedItem.status}
                        </span>
                        {listingMode === "update" && (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-200">
                            Update Mode
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {listingMode === "update" && existingListing?.price && (
                        <div className="text-sm text-moss-600 line-through">
                          Old: ${existingListing.price}
                        </div>
                      )}
                      <div className="text-sm text-moss-600">
                        {listingMode === "update"
                          ? "Update Price"
                          : "Starting Price"}
                        : ${listingData.startingPrice || "0"}
                      </div>
                    </div>

                    <div className="text-sm text-moss-600">
                      <p className="line-clamp-3">{listingData.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SKU and Quantity */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-ink font-urbanist text-xl">
                    Listing Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="sku"
                        className="flex items-center gap-2 text-ink font-urbanist"
                      >
                        <Hash className="h-4 w-4 text-goldYellow/70" />
                        SKU Number
                      </Label>
                      <Input
                        id="sku"
                        value={listingData.sku}
                        onChange={(e) =>
                          setListingData({
                            ...listingData,
                            sku: e.target.value,
                          })
                        }
                        disabled={listingMode === "update"} // Read-only in update mode
                        className="bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                        placeholder="Enter SKU"
                      />
                      {listingMode === "update" && (
                        <p className="text-xs text-moss-500 mt-1">
                          SKU cannot be changed for existing listings
                        </p>
                      )}
                    </div>
                    <div>
                      <Label
                        htmlFor="quantity"
                        className="flex items-center gap-2 text-ink font-urbanist"
                      >
                        <Package className="h-4 w-4 text-goldYellow/70" />
                        Quantity
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={listingData.quantity}
                        onChange={(e) =>
                          setListingData({
                            ...listingData,
                            quantity: e.target.value,
                          })
                        }
                        className="bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                      />
                      {listingMode === "update" &&
                        existingListing?.quantity && (
                          <p className="text-xs text-moss-500 mt-1">
                            Current quantity: {existingListing.quantity}
                          </p>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Generated Title */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-ink font-urbanist text-xl">
                    eBay Title
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Textarea
                      value={listingData.title}
                      onChange={(e) =>
                        setListingData({
                          ...listingData,
                          title: e.target.value,
                        })
                      }
                      rows={2}
                      maxLength={80}
                      className="bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                    />
                    <div className="flex justify-between text-sm text-moss-600 font-urbanist">
                      <span>SEO optimized for maximum visibility</span>
                      <span>{listingData.title.length}/80 characters</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="shadow-lg">
              <CardContent className="p-12 text-center">
                <div className="text-goldYellow/70 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-urbanist text-ink mb-2">
                  {isLoading ? "Loading Inventory..." : "Select an Item"}
                </h3>
                <p className="text-moss-600 font-urbanist">
                  {isLoading
                    ? "Fetching your inventory items..."
                    : "Choose an inventory item to create an eBay listing"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Listing Settings */}
      {selectedItem && (
        <>
          <Separator className="my-8 bg-goldYellow/30" />

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-ink font-urbanist text-xl">
                eBay Listing Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* eBay Category */}
                {/* <div>
                  <Label htmlFor="category" className="text-ink font-urbanist">eBay Category</Label>
                  <Select
                    value={listingData.category}
                    onValueChange={(value) => setListingData({ ...listingData, category: value })}
                    disabled={listingMode === 'update'} // Disable in update mode
                  >
                    <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                      {EBAY_CATEGORIES.map((category) => (
                        <SelectItem 
                          key={category.id} 
                          value={category.id}
                          className="focus:bg-goldYellow/20 focus:text-ink"
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {listingMode === 'update' && (
                    <p className="text-xs text-moss-500 mt-1">Category cannot be changed for existing listings</p>
                  )}
                </div> */}

                {/* Duration */}
                {/* <div>
                  <Label htmlFor="duration" className="flex items-center gap-2 text-ink font-urbanist">
                    <Calendar className="h-4 w-4 text-goldYellow/70" />
                    Listing Duration
                  </Label>
                  <Select
                    value={listingData.duration}
                    onValueChange={(value) => setListingData({ ...listingData, duration: value })}
                  >
                    <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                      {EBAY_DURATIONS.map((duration) => (
                        <SelectItem 
                          key={duration.value} 
                          value={duration.value}
                          className="focus:bg-goldYellow/20 focus:text-ink"
                        >
                          {duration.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}

                {/* Starting Price */}
                <div>
                  <Label
                    htmlFor="startingPrice"
                    className="flex items-center gap-2 text-ink font-urbanist"
                  >
                    <DollarSign className="h-4 w-4 text-goldYellow/70" />
                    Starting Price
                  </Label>
                  <Input
                    id="startingPrice"
                    type="number"
                    value={listingData.startingPrice}
                    onChange={(e) =>
                      setListingData({
                        ...listingData,
                        startingPrice: e.target.value,
                      })
                    }
                    className="bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                  />
                </div>

                {/* Buy It Now Price */}
                {/* <div>
                  <Label htmlFor="buyItNowPrice" className="text-ink font-urbanist">Buy It Now Price</Label>
                  <Input
                    id="buyItNowPrice"
                    type="number"
                    value={listingData.buyItNowPrice}
                    onChange={(e) => setListingData({ ...listingData, buyItNowPrice: e.target.value })}
                    className="bg-white/30 border-goldYellow/30 text-ink placeholder:text-moss-600/50 focus:border-goldYellow focus:ring-goldYellow/30"
                  />
                  {listingMode === 'update' && existingListing?.price && (
                    <p className="text-xs text-moss-500 mt-1">
                      Current eBay price: ${existingListing.price}
                    </p>
                  )}
                </div> */}

                {/* Shipping Policy */}
                {/* <div>
                  <Label htmlFor="shipping" className="flex items-center gap-2 text-ink font-urbanist">
                    <Truck className="h-4 w-4 text-goldYellow/70" />
                    Shipping Policy
                  </Label>
                  <Select
                    value={listingData.shippingPolicy}
                    onValueChange={(value) => setListingData({ ...listingData, shippingPolicy: value })}
                  >
                    <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                      {BUSINESS_POLICIES.shipping.map((policy) => (
                        <SelectItem 
                          key={policy.id} 
                          value={policy.id}
                          className="focus:bg-goldYellow/20 focus:text-ink"
                        >
                          {policy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}

                {/* Return Policy */}
                {/* <div>
                  <Label htmlFor="returns" className="flex items-center gap-2 text-ink font-urbanist">
                    <RotateCcw className="h-4 w-4 text-goldYellow/70" />
                    Return Policy
                  </Label>
                  <Select
                    value={listingData.returnPolicy}
                    onValueChange={(value) => setListingData({ ...listingData, returnPolicy: value })}
                  >
                    <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                      {BUSINESS_POLICIES.returns.map((policy) => (
                        <SelectItem 
                          key={policy.id} 
                          value={policy.id}
                          className="focus:bg-goldYellow/20 focus:text-ink"
                        >
                          {policy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - UPDATED for 2-step mode */}
          <div className="flex justify-end gap-4 mt-8">
            {/* <Button variant="outline" className="border-goldYellow/50 text-ink hover:bg-goldYellow/10 transition-all duration-300 font-urbanist">
              Save as Draft
            </Button> */}
            <Button
              onClick={
                listingMode === "create"
                  ? handleCreateListing
                  : handleUpdateListing
              }
              disabled={isCreatingListing || isCheckingListing}
              className={
                listingMode === "create"
                  ? "bg-blue-500 hover:bg-blue-600 border border-blue-400/30 text-white shadow-md hover:shadow-lg transition-all duration-300 font-urbanist px-8"
                  : "bg-sky-500 hover:bg-sky-600 border border-sky-400/30 text-white shadow-md hover:shadow-lg transition-all duration-300 font-urbanist px-8"
              }
            >
              {isCheckingListing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Checking eBay...
                </>
              ) : isCreatingListing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {listingMode === "create"
                    ? "Creating Listing..."
                    : "Updating Listing..."}
                </>
              ) : listingMode === "create" ? (
                "Create eBay Listing"
              ) : (
                "Update eBay Listing"
              )}
            </Button>
          </div>
        </>
      )}

      {/* Success Dialog - UPDATED for 2-step mode with refresh */}
      <AlertDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          setShowSuccessDialog(open);
          if (!open) {
            window.location.reload();
          }
        }}
      >
        <AlertDialogContent className="font-urbanist max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-urbanist font-semibold text-green-600">
              {listingMode === "create"
                ? "🎉 Listing Created!"
                : "✅ Listing Updated!"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-moss-700 space-y-3">
                <p>
                  Your item <strong>"{selectedItem?.name}"</strong> has been
                  successfully {listingMode === "create" ? "listed" : "updated"}{" "}
                  on eBay.
                </p>

                {/* For CREATE mode - Show description without link */}
                {listingMode === "create" && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">
                        Listing Published Successfully
                      </span>
                    </div>
                    <p className="text-sm text-blue-600">
                      Your eBay listing is now live! You can view and manage it
                      in the
                      <strong> "Active Listings" </strong>
                      tab where you'll find the direct eBay URL link.
                    </p>
                  </div>
                )}

                {/* For UPDATE mode - Keep the existing link */}
                {listingMode === "update" && existingListing?.listing_url && (
                  <div className="mt-3">
                    <a
                      href={existingListing.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View your updated listing on eBay
                    </a>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowSuccessDialog(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
