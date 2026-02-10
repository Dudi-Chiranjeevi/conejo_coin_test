// ---------- API SHAPES ----------

export interface LookupCertResponse {
  existing_inventory: ExistingCoin | null;
  is_duplicate: boolean;
  ngc: NGCApiResponse;
}

export interface ExistingCoin {
  id: string;
  name: string;
  certNumber?: string;
  identification_number?: string;  
  addedDate?: string;
  date_added?: string;             
  thumbnail?: string;
  status?: string;
  price?: string;
  attributes?: string | object;
  images?: string | object;
}

export interface NGCApiResponse {
  certNumber: string;
  collectible: Collectible;         // ← source of truth for coin facts
  additionalInfo: AdditionalInfo;
  grade: Grade;
  images: CoinImages;
  metadata: Metadata;
  // population?: Population;
}

export interface Collectible {
  collectibleID: string;
  denomination: string;             // e.g., "10CASH"
  year: string;                     // e.g., "1808"
  mintMark: string;                 // e.g., "INDIA"
  proofMint: string;                // e.g., "MS"
  strike: string;                   // e.g., "BN"
  variety1: string;
  variety2: string;
  variety3: string;
  description: string | null;
  fineness: string;                 // may be ""
  metalType: string;                // may be ""
  weightGrams: number;
  weightOunces: number;
  universalCoinID: string;
  rollupNumber: string | null;
}

export interface AdditionalInfo {
  gradeComment: string | null;
  graderNotes: string | null;
  labelCode: string;
  pedigree: string;
  pedigree2: string;
}

export interface Grade {
  grade: string;                    // "UNC"
  displayGrade: string;             // "UNC DETAILS "
  gradeType: string;                // "D"
  noGradeCode: string;              // "SL"
  ancientGrades: {
    strike: string;
    surface: string;
    style: string;
    weight: string;
    notation: string;
  };
}

export interface CoinImages {
  frontUrl: string;
  rearUrl: string;
  frontThumbnailUrl: string;
  rearThumbnailUrl: string;
}

export interface Metadata {
  barcode: string;
  gradedDate: string;               // "YYYY-MM-DD"
  encapsulationDate: string;        // "YYYY-MM-DD"
  submissionNumber: string | null;
}

// ---------- UI SHAPE ----------

export interface NGCData {
  certNumber: string;
  title: string;             // e.g., "1808 INDIA 10CASH MADRAS PRESIDENCY (UNC DETAILS)"
  grade: string;
  gradeComment?: string | null;

  year?: number;
  mintMark?: string;
  denomination?: string;
  variety?: string;
  strike?: string;
  proofMint?: string;
  metalType?: string;
  fineness?: string;
  gradedDate?: string;
  
  // Additional fields for inventory management
  description?: string;
  price?: string | number;
  lookup_url?: string;

  obverseUrl: string;
  reverseUrl: string;
  obverseThumbUrl: string;
  reverseThumbUrl: string;
}

// ---------- MAPPER ----------

// treat "", null, undefined as undefined
const clean = <T extends string | undefined | null>(v: T): T | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? (s as T) : undefined;
};

export function mapExistingItemToNGCData(item: ExistingCoin): NGCData {
  // Parse attributes JSON if available
  let attributes: any = {};
  try {
    if (typeof item.attributes === 'string') {
      attributes = JSON.parse(item.attributes);
    } else if (typeof item.attributes === 'object') {
      attributes = item.attributes;
    }
  } catch (e) {
    console.error("Error parsing attributes JSON:", e);
  }

  // Extract nested objects from attributes
  const coin = attributes?.coin || {};
  const grade = attributes?.grade || {};
  const metadata = attributes?.metadata || {};
  
  // Extract any embedded data from the name if possible as fallback
  const yearMatch = item.name?.match(/\b\d{4}\b/);
  const gradeMatch = item.name?.match(/\(([^)]+)\)/);
  
  // Parse images JSON if available
  let imageUrls = {
    front: "",
    rear: "",
    frontThumb: "",
    rearThumb: ""
  };

  try {
    let imagesArray = [];
    
    if (typeof item.images === 'string') {
      imagesArray = JSON.parse(item.images);
    } else if (Array.isArray(item.images)) {
      imagesArray = item.images;
    }
    
    // Get the first image object if it exists
    if (imagesArray && imagesArray.length > 0) {
      const imageObj = imagesArray[0];
      imageUrls = {
        front: imageObj.front_url || "",
        rear: imageObj.rear_url || "",
        frontThumb: imageObj.front_thumbnail_url || "",
        rearThumb: imageObj.rear_thumbnail_url || ""
      };
    }
  } catch (e) {
    console.error("Error parsing images JSON:", e);
  }

  let price: number | undefined = undefined;
  if (item.price) {
    const parsedPrice = parseFloat(item.price);
    if (!isNaN(parsedPrice)) {
      price = parsedPrice;
    }
  }
  
  return {
    certNumber: item.identification_number || item.certNumber || item.id || "",
    title: item.name,
    price: price,
    grade: grade?.display || grade?.label || (gradeMatch ? gradeMatch[1] : ""),
    gradeComment: grade?.comment || null,
    
    // Try to extract year from attributes or name
    year: coin?.year ? parseInt(coin.year, 10) : (yearMatch ? parseInt(yearMatch[0], 10) : undefined),
    
    // Extract fields from attributes.coin
    mintMark: coin?.mint_mark || coin?.mintMark,
    denomination: coin?.denomination,
    variety: coin?.variety,
    strike: coin?.strike,
    proofMint: coin?.proof_mint || coin?.proofMint,
    metalType: coin?.metal_type || coin?.metalType,
    fineness: coin?.fineness,
    gradedDate: metadata?.graded_date || metadata?.gradedDate,
    
    // Use validated image URLs
    obverseUrl: imageUrls.front || item.thumbnail || "",
    reverseUrl: imageUrls.rear || item.thumbnail || "",
    obverseThumbUrl: imageUrls.frontThumb || item.thumbnail || "",
    reverseThumbUrl: imageUrls.rearThumb || item.thumbnail || "",
  };
}

export function mapApiResponseToNGCData(api: NGCApiResponse | null): NGCData {
  // Handle null API response
  if (!api) {
    return {
      certNumber: "",
      title: "Unknown Coin",
      grade: "",
      obverseUrl: "",
      reverseUrl: "",
      obverseThumbUrl: "",
      reverseThumbUrl: "",
    };
  }

  const c = api.collectible ?? ({} as Collectible);

  const yearStr = clean(c.year);
  const denomination = clean(c.denomination);
  const mintMark = clean(c.mintMark);
  const metalType = clean(c.metalType);
  const variety1 = clean(c.variety1);
  const variety2 = clean(c.variety2);
  const strike = clean(c.strike);
  const proofMint = clean(c.proofMint);
  const fineness = clean(c.fineness);

  const displayGrade =
    clean(api.grade?.displayGrade) || clean(api.grade?.grade) || "";

  const baseTitleParts = [
    yearStr,
    mintMark,
    denomination,
    variety1,
  ].filter(Boolean) as string[];

  const title = displayGrade
    ? `${baseTitleParts.join(" ")} (${displayGrade})`
    : baseTitleParts.join(" ") || api.certNumber || "Coin";

  return {
    certNumber: api.certNumber || "",
    title,
    grade: displayGrade || "",
    gradeComment: api.additionalInfo?.gradeComment ?? null,

    year: yearStr ? parseInt(yearStr, 10) : undefined,
    mintMark,
    denomination,
    variety: variety1 || variety2,
    strike,
    proofMint,
    metalType,
    fineness,
    gradedDate: clean(api.metadata?.gradedDate),

    obverseUrl: clean(api.images?.frontUrl) || "",
    reverseUrl: clean(api.images?.rearUrl) || "",
    obverseThumbUrl: clean(api.images?.frontThumbnailUrl) || "",
    reverseThumbUrl: clean(api.images?.rearThumbnailUrl) || "",
  };
}


// ------------------------ Mock Data ------------------------
// Updated mock data without default values
// export const mockNGCData: NGCData = {
//   certNumber: "6922813-006",
//   grade: "AU DETAILS",
//   gradeComment: "",
//   year: 1808,
//   mintMark: undefined,
//   denomination: "10CASH",
//   coinType: "MADRAS PRESIDENCY (4.7g)",
//   metalType: "Silver",
//   gradedDate: "2025-03-03",
//   obverseUrl: "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17413727-57ca-4193-9dee-a42fbb270ad0/NGC6922813-006_OBV.jpg",
//   reverseUrl: "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17413727-57ca-4193-9dee-a42fbb270ad0/NGC6922813-006_REV.jpg",
//   authenticGrade: true,
//   certificationFee: undefined,
// }

// export const mockExistingCoins: ExistingCoin[] = [
//   {
//     id: 1,
//     name: "1808 MADRAS PRESIDENCY (4.7g) 10CASH - AU DETAILS",
//     certNumber: "6922813-006",
//     addedDate: "2024-01-15",
//   },
// ]

// // Mock API functions
// export const mockNGCLookup = async (certNumber: string): Promise<NGCData> => {
//   // Simulate API delay
//   await new Promise((resolve) => setTimeout(resolve, 2000))

//   if (certNumber === "6922813-006") {
//     return mockNGCData
//   }

//   throw new Error("Certificate not found")
// }

// export const checkForDuplicate = (certNumber: string): ExistingCoin | null => {
//   return mockExistingCoins.find((coin) => coin.certNumber === certNumber) || null
// }

// Helper function to create coin name from NGC data
export const generateCoinName = (ngcData: NGCData): string => {
  const parts = [
    ngcData.year,
    ngcData.metalType,
    ngcData.denomination,
    ngcData.grade ? `- ${ngcData.grade}` : ''
  ].filter(Boolean);
  
  return parts.join(' ');
}

// Sample API response data for testing
export const sampleApiResponse = {
    "existing_inventory": null,
    "is_duplicate": false,
    "ngc": {
      "certNumber": "8318039-203",
      "year": "1808",
      "denomination": "10CASH",
      "mintMark": "INDIA",
      "proofMint": "MS",
      "strike": "BN",
      "variety1": "MADRAS PRESIDENCY (4.7g)",
      "variety2": "",
      "variety3": "",
      "description": null,
      "fineness": "",
      "metalType": "",
      "weightGrams": 0,
      "weightOunces": 0,
      "universalCoinID": "334007",
      "collectibleID": "303269",
      "additionalInfo": {
        "gradeComment": "SEA SALVAGED",
        "graderNotes": null,
        "labelCode": "0819",
        "pedigree": "Admiral Gardner",
        "pedigree2": ""
      },
      "grade": {
        "grade": "UNC",
        "displayGrade": "UNC DETAILS ",
        "gradeType": "D",
        "noGradeCode": "SL",
        "ancientGrades": {
          "strike": "",
          "surface": "",
          "style": "",
          "weight": "",
          "notation": ""
        }
      },
      "images": {
        "frontUrl": "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17253948-896c-42d6-9694-f2445a98d72c/NGC8318039-203_OBV.jpg",
        "rearUrl": "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17253948-896c-42d6-9694-f2445a98d72c/NGC8318039-203_REV.jpg",
        "frontThumbnailUrl": "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17253948-896c-42d6-9694-f2445a98d72c/TN_NGC8318039-203_OBV.jpg",
        "rearThumbnailUrl": "https://ccg-imaging-ngc-coins-production.s3.amazonaws.com/17253948-896c-42d6-9694-f2445a98d72c/TN_NGC8318039-203_REV.jpg"
      },
      "metadata": {
        "barcode": "30326989858318039203",
        "gradedDate": "2024-09-03",
        "encapsulationDate": "2024-09-03",
        "submissionNumber": null
      },
      "population": {
        "populationAtGrade": 2839,
        "population_1": 2,
        "population_55": 2,
        "population_58": 7,
        "population_61": 3,
        "population_62": 6,
        "population_63": 6,
        "population_64": 4,
        "population_65": 1,
        "population_UNC_Details": 2839,
        "population_AU_Details": 80,
        "population_VF_Details": 14,
        "population_XF_Details": 22,
        "population_FAIR_Details": 0,
        "population_F_Details": 0,
        "population_G_Details": 0,
        "population_VG_Details": 0,
        "population_POOR_Details": 0,
        "population_AG_Details": 0,
        "population_2": 0,
        "population_3": 0,
        "population_4": 0,
        "population_6": 0,
        "population_8": 0,
        "population_10": 0,
        "population_12": 0,
        "population_15": 0,
        "population_20": 0,
        "population_25": 0,
        "population_30": 0,
        "population_35": 0,
        "population_40": 0,
        "population_45": 0,
        "population_45Plus": 0,
        "population_45Star": 0,
        "population_45PlusStar": 0,
        "population_50": 0,
        "population_50Star": 0,
        "population_50Plus": 0,
        "population_50PlusStar": 0,
        "population_53": 0,
        "population_53Star": 0,
        "population_53Plus": 0,
        "population_53PlusStar": 0,
        "population_55Star": 0,
        "population_55Plus": 0,
        "population_55PlusStar": 0,
        "population_58Star": 0,
        "population_58Plus": 0,
        "population_58PlusStar": 0,
        "population_60": 0,
        "population_60Star": 0,
        "population_60Plus": 0,
        "population_60PlusStar": 0,
        "population_61Star": 0,
        "population_61Plus": 0,
        "population_61PlusStar": 0,
        "population_62Star": 0,
        "population_62Plus": 0,
        "population_62PlusStar": 0,
        "population_63Star": 0,
        "population_63Plus": 0,
        "population_63PlusStar": 0,
        "population_64Star": 0,
        "population_64Plus": 0,
        "population_64PlusStar": 0,
        "population_65Star": 0,
        "population_65Plus": 0,
        "population_65PlusStar": 0,
        "population_66": 0,
        "population_66Star": 0,
        "population_66Plus": 0,
        "population_66PlusStar": 0,
        "population_67": 0,
        "population_67Star": 0,
        "population_67Plus": 0,
        "population_67PlusStar": 0,
        "population_68": 0,
        "population_68Star": 0,
        "population_68Plus": 0,
        "population_68PlusStar": 0,
        "population_69": 0,
        "population_69Star": 0,
        "population_70": 0,
        "population_70Star": 0
      }
    }
  }
