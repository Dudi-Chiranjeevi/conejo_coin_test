# services/ngc_normalizer.py
from typing import Dict, Any, Optional

def _parse_grade_parts(display_grade: Optional[str]) -> Dict[str, Any]:
    """
    Examples:
      "PF 69 ULTRA CAMEO" -> label="PF", numeric=69, suffix="ULTRA CAMEO"
      "MS 65"             -> label="MS", numeric=65
    """
    if not display_grade:
        return {"label": None, "numeric": None, "suffix": None}

    parts = display_grade.strip().split()
    label = parts[0] if parts else None
    numeric = None
    suffix = None

    # Find first integer-like token
    for p in parts[1:]:
        if p.isdigit():
            numeric = int(p)
            break

    # Everything after numeric is suffix (if any)
    if numeric is not None:
        idx = parts.index(str(numeric))
        rest = parts[idx + 1 :]
        suffix = " ".join(rest) if rest else None
    else:
        # no numeric found; treat everything after label as suffix
        suffix = " ".join(parts[1:]) if len(parts) > 1 else None

    return {"label": label, "numeric": numeric, "suffix": suffix}

# ngc_integration/inventory_service.py (or services/mapper.py)
def normalize_ngc_for_inventory(ngc: dict) -> dict:
    # Handle both v2 and v3 API response formats
    # Print the keys to help with debugging
    print(f"NGC data keys: {list(ngc.keys() if ngc else [])}")
    
    # Extract data from different possible structures
    c = (ngc or {}).get("collectible", {}) or {}
    g = (ngc or {}).get("grade", {}) or {}
    m = (ngc or {}).get("metadata", {}) or {}
    
    # Handle v3 API response format which might have images in a different structure
    img = {}
    if "images" in ngc:
        if isinstance(ngc["images"], dict):
            # v2 format
            img = ngc["images"]
        elif isinstance(ngc["images"], list) and len(ngc["images"]) > 0:
            # v3 format - images is a list
            print(f"Found images list with {len(ngc['images'])} items")
            for image_item in ngc["images"]:
                print(f"Image item keys: {list(image_item.keys() if image_item else [])}")
                # Extract image URLs based on type
                if image_item.get("type") == "obverse" or image_item.get("imageType") == "obverse":
                    img["frontUrl"] = image_item.get("url") or image_item.get("imageUrl")
                    img["frontThumbnailUrl"] = image_item.get("thumbnailUrl") or image_item.get("url") or image_item.get("imageUrl")
                elif image_item.get("type") == "reverse" or image_item.get("imageType") == "reverse":
                    img["rearUrl"] = image_item.get("url") or image_item.get("imageUrl")
                    img["rearThumbnailUrl"] = image_item.get("thumbnailUrl") or image_item.get("url") or image_item.get("imageUrl")
    else:
        # Look for images in other possible locations
        for key in ngc.keys():
            if isinstance(ngc[key], dict) and "images" in ngc[key]:
                print(f"Found images in {key}")
                if isinstance(ngc[key]["images"], dict):
                    img = ngc[key]["images"]
                elif isinstance(ngc[key]["images"], list) and len(ngc[key]["images"]) > 0:
                    for image_item in ngc[key]["images"]:
                        if image_item.get("type") == "obverse" or image_item.get("imageType") == "obverse":
                            img["frontUrl"] = image_item.get("url") or image_item.get("imageUrl")
                            img["frontThumbnailUrl"] = image_item.get("thumbnailUrl") or image_item.get("url") or image_item.get("imageUrl")
                        elif image_item.get("type") == "reverse" or image_item.get("imageType") == "reverse":
                            img["rearUrl"] = image_item.get("url") or image_item.get("imageUrl")
                            img["rearThumbnailUrl"] = image_item.get("thumbnailUrl") or image_item.get("url") or image_item.get("imageUrl")

    # Handle different possible image field names in the NGC API response
    front_url = img.get("frontUrl") or img.get("front_url") or img.get("obverse") or img.get("obverseUrl") or ""
    rear_url = img.get("rearUrl") or img.get("rear_url") or img.get("reverse") or img.get("reverseUrl") or ""
    front_thumbnail_url = img.get("frontThumbnailUrl") or img.get("front_thumbnail_url") or img.get("obverseThumbnail") or img.get("obverseThumbnailUrl") or ""
    rear_thumbnail_url = img.get("rearThumbnailUrl") or img.get("rear_thumbnail_url") or img.get("reverseThumbnail") or img.get("reverseThumbnailUrl") or ""
    
    # Ensure all URLs use HTTPS
    def ensure_https(url):
        if url and url.startswith('http:'):
            return url.replace('http:', 'https:', 1)
        return url
    
    front_url = ensure_https(front_url)
    rear_url = ensure_https(rear_url)
    front_thumbnail_url = ensure_https(front_thumbnail_url)
    rear_thumbnail_url = ensure_https(rear_thumbnail_url)
    
    # Log the image URLs for debugging
    print(f"NGC Image URLs - Front: {front_url}, Rear: {rear_url}, Front Thumbnail: {front_thumbnail_url}, Rear Thumbnail: {rear_thumbnail_url}")
    
    # images array item
    images = [{
        "source": "ngc",
        "meta": {},
        "front_url": front_url,
        "rear_url": rear_url,
        "front_thumbnail_url": front_thumbnail_url,
        "rear_thumbnail_url": rear_thumbnail_url,
    }]

    # thumbnail fallback
    thumbnail = front_thumbnail_url or front_url or ""

    # attributes
    attributes = {
        "cert_number": ngc.get("certNumber"),
        "coin": {
            "year": c.get("year"),
            "mint_mark": c.get("mintMark"),
            "denomination": c.get("denomination"),
            "variety": c.get("variety1") or c.get("variety2") or c.get("variety3"),
            "metal_type": c.get("metalType") or None,
            "fineness": c.get("fineness") or None,
        },
        "grade": {
            "service": "NGC",
            "label": g.get("grade"),
            "display": (g.get("displayGrade") or "").strip(),
            "type": g.get("gradeType"),
            "no_grade_code": g.get("noGradeCode"),
            "comment": (ngc.get("additionalInfo") or {}).get("gradeComment"),
        },
        "metadata": {
            "barcode": m.get("barcode"),
            "graded_date": m.get("gradedDate"),
            "encapsulation_date": m.get("encapsulationDate"),
            "submission_number": m.get("submissionNumber"),
        },
        # Optionally keep a link to the NGC lookup page
        "lookup_url": None,
    }

    title_bits = [c.get("year"), c.get("mintMark"), c.get("denomination"), c.get("variety1")]
    title = " ".join([b for b in title_bits if b]) or ngc.get("certNumber") or "Coin"

    return {
        "name": title,
        "thumbnail": thumbnail,
        "images": images,
        "attributes": attributes,
        "identification_number": ngc.get("certNumber"),
        "lookup_url": None,
    }
