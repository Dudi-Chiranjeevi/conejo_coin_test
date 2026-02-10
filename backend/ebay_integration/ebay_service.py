import requests
from django.conf import settings
from typing import Optional, Dict, Any, List
import json
from urllib.parse import quote
import base64
from datetime import datetime
from .ebay_auth import get_ebay_auth_token
from .tokens import ebay_token_manager

class EbayService:
    def __init__(self, sandbox=True, request=None):
        self.config = settings.EBAY_CONFIG['SANDBOX' if sandbox else 'PRODUCTION']
        self.base_url = self.config['base_url']
        self.sandbox = sandbox
        self.request = request
        
        # 🆕 INITIALIZE WITH REFRESH TOKEN FROM CONFIG
        if not ebay_token_manager.get_refresh_token() and self.config.get('refresh_token'):
            ebay_token_manager.set_refresh_token(self.config['refresh_token'])
            print(f"🔄 Initialized with refresh token: {self.config['refresh_token'][:20]}...")
        
        # 🆕 GET TOKEN USING NGC-STYLE MANAGEMENT
        self.auth_token = get_ebay_auth_token(request)
        
        self.headers = {
            'Authorization': f"Bearer {self.auth_token}",
            'Content-Type': 'application/json',
            'Content-Language': 'en-US',
        }
        # Your business policy IDs
        self.business_policies = {
            'fulfillmentPolicyId': '6211285000',
            'paymentPolicyId': '6211298000', 
            'returnPolicyId': '6211299000',
        }

    def _make_authenticated_request(self, method, url, **kwargs):
        """
        🆕 MAKE AUTHENTICATED REQUEST WITH TOKEN MANAGEMENT
        """
        try:
            # Ensure token is fresh
            self.auth_token = get_ebay_auth_token(self.request)
            self.headers['Authorization'] = f"Bearer {self.auth_token}"
            
            print(f"🔐 Making {method} request to {url}")
            response = requests.request(method, url, headers=self.headers, **kwargs)
            return response
        except Exception as e:
            print(f"❌ API call failed: {e}")
            raise

    def debug_listing_state(self, offer_id: str):
        """Debug function to check current listing state"""
        try:
            url = f"{self.base_url}/sell/inventory/v1/offer/{offer_id}"
            response = self._make_authenticated_request('GET', url, timeout=30)
            
            print("🔍 CURRENT LISTING STATE:")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                listing_data = response.json()
                print(f"Offer ID: {listing_data.get('offerId')}")
                print(f"SKU: {listing_data.get('sku')}")
                print(f"Status: {listing_data.get('status')}")
                print(f"Marketplace: {listing_data.get('marketplaceId')}")
                print(f"Format: {listing_data.get('format')}")
                print(f"Category: {listing_data.get('categoryId')}")
                print(f"Pricing Summary: {json.dumps(listing_data.get('pricingSummary', {}), indent=2)}")
                print(f"Availability: {json.dumps(listing_data.get('availability', {}), indent=2)}")
                print(f"Listing Description: {listing_data.get('listingDescription', '')[:100]}...")
                print(f"Merchant Location: {listing_data.get('merchantLocationKey')}")
                return listing_data
            else:
                print(f"❌ Cannot get listing state: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Debug error: {e}")
            return None

    def update_listing(self, offer_id: str, new_price: float, new_quantity: int) -> Optional[Dict[str, Any]]:
        """
        FIXED: Exact price value without rounding
        """
        try:
            url = f"{self.base_url}/sell/inventory/v1/offer/{offer_id}"
            
            print("=" * 50)
            print("🔄 UPDATING LISTING - EXACT PRICE")
            print("=" * 50)
            
            # Get current listing state
            current_listing = self.debug_listing_state(offer_id)
            if not current_listing:
                return {'error': 'Cannot retrieve current listing state'}
            
            # ✅ EXACT PRICE without rounding
            payload = {
                "sku": current_listing.get('sku'),
                "marketplaceId": "EBAY_US",
                "format": "FIXED_PRICE",
                "availableQuantity": int(new_quantity),
                "categoryId": current_listing.get('categoryId') or "102504",
                "listingDescription": current_listing.get('listingDescription', 'Collectible coin in excellent condition'),
                "listingPolicies": {
                    "fulfillmentPolicyId": self.business_policies['fulfillmentPolicyId'],
                    "paymentPolicyId": self.business_policies['paymentPolicyId'],
                    "returnPolicyId": self.business_policies['returnPolicyId'],
                    "eBayPlusIfEligible": False
                },
                "pricingSummary": {
                    "price": {
                        "value": str(new_price),  # ✅ No rounding - exact value
                        "currency": "USD"
                    }
                },
                "merchantLocationKey": "Store1",
                "tax": {
                    "applyTax": False
                },
                "includeCatalogProductDetails": True,
                "hideBuyerDetails": False
            }
            
            # Add listingDuration if it exists
            if current_listing.get('listingDuration'):
                payload["listingDuration"] = current_listing.get('listingDuration')
            
            print(f"✏️ Updating offer: {offer_id}")
            print(f"💰 New price: ${new_price} (exact value)")
            print(f"📦 New quantity: {new_quantity}")
            print(f"📋 Complete payload: {json.dumps(payload, indent=2)}")
            
            response = self._make_authenticated_request('PUT', url, json=payload, timeout=30)
            print(f"✏️ Response: {response.status_code}")
            print(f"📋 Response body: {response.text}")
            
            if response.status_code in [200, 204]:
                print("✅ LISTING UPDATE COMPLETED")
                return {
                    'success': True,
                    'step': 'update',
                    'offer_id': offer_id,
                    'new_price': new_price,
                    'new_quantity': new_quantity,
                    'message': 'Listing updated successfully'
                }
            else:
                print(f"❌ UPDATE FAILED: {response.status_code}")
                return {'error': f'HTTP {response.status_code}: {response.text}'}
                    
        except Exception as e:
            print(f"❌ UPDATE ERROR: {e}")
            return {'error': str(e)}
    
    def get_item_listing(self, item_id: str) -> Optional[Dict[str, Any]]:
        """
        Get basic listing information for an eBay item including availability
        """
        try:
            # URL encode the item_id to handle pipes and special characters
            encoded_item_id = quote(item_id, safe='')
            url = f"{self.base_url}/buy/browse/v1/item/{encoded_item_id}"
            
            print(f"Fetching eBay listing for item: {item_id}")
            print(f"Encoded URL: {url}")
            
            response = self._make_authenticated_request('GET', url, timeout=30)
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                item_data = response.json()
                print(f"Successfully fetched item: {item_data.get('title', 'Unknown')}")
                return self._parse_listing_data(item_data)
            elif response.status_code == 404:
                return {'error': 'Item not found'}
            else:
                print(f"Error response: {response.text}")
                return {'error': f'HTTP {response.status_code}: {response.text}'}
                
        except Exception as e:
            print(f"Error fetching eBay item: {e}")
            return {'error': str(e)}
    
    def _parse_listing_data(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse listing information including availability data
        """
        # Extract availability information
        estimated_availability = item_data.get('estimatedAvailabilities', [{}])[0] if item_data.get('estimatedAvailabilities') else {}
        
        return {
            # Basic Identification
            'item_id': item_data.get('itemId'),
            'title': item_data.get('title'),
            
            # Pricing
            'current_price': item_data.get('price', {}).get('value'),
            'currency': item_data.get('price', {}).get('currency', 'USD'),
            
            # Listing Status
            'listing_type': item_data.get('listingType'),
            'condition': item_data.get('condition'),
            
            # URLs
            'view_item_url': item_data.get('itemWebUrl'),
            'image_url': item_data.get('image', {}).get('imageUrl'),
            
            # Seller
            'seller_username': item_data.get('seller', {}).get('username'),
            
            # Dates
            'start_time': item_data.get('itemCreationDate'),
            'end_time': item_data.get('itemEndDate'),
            
            # Availability Information (NEW)
            'availability': {
                'estimated_availability_status': estimated_availability.get('estimatedAvailabilityStatus'),
                'estimated_available_quantity': estimated_availability.get('estimatedAvailableQuantity'),
                'estimated_sold_quantity': estimated_availability.get('estimatedSoldQuantity'),
                'estimated_remaining_quantity': estimated_availability.get('estimatedRemainingQuantity'),
                'delivery_options': estimated_availability.get('deliveryOptions', []),
                'ship_to_locations': estimated_availability.get('shipToLocations', {}),
            },
            
            # Additional useful fields
            'buying_options': item_data.get('buyingOptions', []),
            'item_location': item_data.get('itemLocation', {}),
            'shipping_options': item_data.get('shippingOptions', []),
            'return_terms': item_data.get('returnTerms', {}),
            
            # Raw response for debugging
            'raw_response': item_data
        }

    def create_inventory_item(self, inventory_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        STEP 1: Create Inventory Item
        PUT /sell/inventory/v1/inventory_item/{sku}
        """
        try:
            sku = inventory_data.get('sku')
            if not sku:
                return {'error': 'SKU is required'}
            
            url = f"{self.base_url}/sell/inventory/v1/inventory_item/{sku}"
            
            print("=" * 50)
            print("🔄 STEP 1: CREATING INVENTORY ITEM")
            print("=" * 50)
            
            # Build aspects
            aspects = {}
            if inventory_data.get('aspects'):
                for key, value in inventory_data.get('aspects', {}).items():
                    aspects[key] = [str(value)] if not isinstance(value, list) else value
            
            # Handle images - use direct URLs (no upload needed)
            image_urls = []
            if inventory_data.get('image_urls'):
                image_urls = inventory_data.get('image_urls', [])
            elif inventory_data.get('images'):
                image_urls = inventory_data.get('images', [])
            elif inventory_data.get('image_url'):
                image_urls = [inventory_data.get('image_url')]
            
            print(f"📸 Using {len(image_urls)} direct image URLs")
            
            # Prepare payload
            payload = {
                "availability": {
                    "shipToLocationAvailability": {
                        "quantity": inventory_data.get('quantity', 1)
                    }
                },
                "condition": "NEW",
                "product": {
                    "title": inventory_data.get('title'),
                    "description": inventory_data.get('description'),
                    "aspects": aspects,
                    "imageUrls": image_urls  # Direct URLs - eBay can handle these
                }
            }
            
            print(f"📦 Sending inventory item creation...")
            print(f"📦 SKU: {sku}")
            print(f"📦 Title: {inventory_data.get('title')}")
            print(f"📦 Images: {len(image_urls)}")
            
            response = self._make_authenticated_request('PUT', url, json=payload, timeout=30)
            print(f"📦 Response: {response.status_code}")
            
            if response.status_code in [200, 201, 204]:
                print("✅ STEP 1 COMPLETED: Inventory item created")
                return {
                    'success': True,
                    'step': 'inventory_item',
                    'sku': sku,
                    'images_count': len(image_urls),
                    'image_urls': image_urls
                }
            else:
                print(f"❌ STEP 1 FAILED: {response.text}")
                return {'error': f'HTTP {response.status_code}: {response.text}'}
                
        except Exception as e:
            print(f"❌ STEP 1 ERROR: {e}")
            return {'error': str(e)}

    def create_offer(self, offer_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        STEP 2: Create Offer
        POST /sell/inventory/v1/offer
        """
        try:
            url = f"{self.base_url}/sell/inventory/v1/offer"
            
            print("=" * 50)
            print("🔄 STEP 2: CREATING OFFER")
            print("=" * 50)
            
            payload = {
                "sku": offer_data.get('sku'),
                "marketplaceId": "EBAY_US",
                "format": "FIXED_PRICE",
                "availableQuantity": offer_data.get('quantity', 1),
                "categoryId": "102504",  # Coin category
                "listingDescription": offer_data.get('description'),
                "listingPolicies": {
                    "fulfillmentPolicyId": self.business_policies['fulfillmentPolicyId'],
                    "paymentPolicyId": self.business_policies['paymentPolicyId'],
                    "returnPolicyId": self.business_policies['returnPolicyId']
                },
                "pricingSummary": {
                    "price": {
                        "value": str(offer_data.get('price')),
                        "currency": offer_data.get('currency', 'USD')
                    }
                },
                "merchantLocationKey": "Store1"
            }
            
            # Add optional fields
            if offer_data.get('listing_duration'):
                payload["listingDuration"] = offer_data.get('listing_duration')
            
            print(f"📝 Creating offer for SKU: {offer_data.get('sku')}")
            response = self._make_authenticated_request('POST', url, json=payload, timeout=30)
            print(f"📝 Response: {response.status_code}")
            
            if response.status_code in [200, 201]:
                response_data = response.json()
                offer_id = response_data.get('offerId')
                print(f"✅ STEP 2 COMPLETED: Offer created - ID: {offer_id}")
                
                return {
                    'success': True,
                    'step': 'offer',
                    'offer_id': offer_id,
                    'sku': response_data.get('sku'),
                    'listing_status': response_data.get('listing', {}).get('listingStatus'),
                    'offer_data': response_data
                }
            else:
                print(f"❌ STEP 2 FAILED: {response.text}")
                return {'error': f'HTTP {response.status_code}: {response.text}'}
                
        except Exception as e:
            print(f"❌ STEP 2 ERROR: {e}")
            return {'error': str(e)}

    def publish_offer(self, offer_id: str) -> Optional[Dict[str, Any]]:
        """
        STEP 3: Publish Offer
        POST /sell/inventory/v1/offer/{offerId}/publish
        """
        try:
            url = f"{self.base_url}/sell/inventory/v1/offer/{offer_id}/publish"
            
            print("=" * 50)
            print("🔄 STEP 3: PUBLISHING OFFER")
            print("=" * 50)
            
            print(f"🚀 Publishing offer: {offer_id}")
            response = self._make_authenticated_request('POST', url, timeout=30)
            print(f"🚀 Response: {response.status_code}")
            
            if response.status_code in [200, 201]:
                response_data = response.json()
                listing_id = response_data.get('listingId')
                print(f"✅ STEP 3 COMPLETED: Offer published - Listing ID: {listing_id}")
                
                return {
                    'success': True,
                    'step': 'publish',
                    'listing_id': listing_id,
                    'offer_id': offer_id,
                    'status': response_data.get('status'),
                    'listing_url': f"https://www.ebay.com/itm/{listing_id}" if listing_id else None,
                    'publish_data': response_data
                }
            else:
                print(f"❌ STEP 3 FAILED: {response.text}")
                return {'error': f'HTTP {response.status_code}: {response.text}'}
                
        except Exception as e:
            print(f"❌ STEP 3 ERROR: {e}")
            return {'error': str(e)}

    def create_complete_listing(self, listing_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        COMPLETE FLOW: Create Inventory Item → Create Offer → Publish Offer
        """
        try:
            results = {}
            
            # Step 1: Create Inventory Item
            print("Step 1: Creating inventory item...")
            inventory_result = self.create_inventory_item(listing_data)
            if 'error' in inventory_result:
                return inventory_result
            results['inventory'] = inventory_result
            
            # Step 2: Create Offer
            print("Step 2: Creating offer...")
            offer_result = self.create_offer(listing_data)
            if 'error' in offer_result:
                return offer_result
            results['offer'] = offer_result
            
            # Step 3: Publish Offer
            print("Step 3: Publishing offer...")
            publish_result = self.publish_offer(offer_result['offer_id'])
            if 'error' in publish_result:
                return publish_result
            results['publish'] = publish_result
            
            return {
                'success': True,
                'listing_id': publish_result['listing_id'],
                'offer_id': offer_result['offer_id'],
                'sku': listing_data.get('sku'),
                'listing_url': publish_result.get('listing_url'),
                'merchant_location': "Store1",
                'category_id': "102504",
                'status': 'PUBLISHED',
                'message': 'Listing created and published successfully',
                'images_count': inventory_result.get('images_count', 0),
                'results': results
            }
            
        except Exception as e:
            print(f"❌ Error in complete listing flow: {e}")
            return {'error': str(e)}

    # def get_all_listings_with_availability(self) -> Optional[Dict[str, Any]]:
    #     """
    #     SINGLE API CALL: Get all listings with availability status
    #     FILTERED: Only return items that exist in inventory (matching identification_number = SKU)
    #     """
    #     try:
    #         print("=" * 50)
    #         print("🚀 SINGLE CALL: GETTING ALL LISTINGS WITH AVAILABILITY (FILTERED)")
    #         print("=" * 50)
            
    #         # Single call to get inventory items with details
    #         url = f"{self.base_url}/sell/inventory/v1/inventory_item"
    #         params = {
    #             'limit': 200,
    #             'offset': 0
    #         }
            
    #         response = self._make_authenticated_request('GET', url, params=params, timeout=30)
    #         print(f"📦 Inventory API Response: {response.status_code}")
            
    #         if response.status_code != 200:
    #             return {'error': f'HTTP {response.status_code}: {response.text}'}
            
    #         inventory_data = response.json()
    #         inventory_items = inventory_data.get('inventoryItems', [])
            
    #         print(f"📊 Found {len(inventory_items)} inventory items from eBay")
            
    #         # Get all identification_numbers from your inventory
    #         from inventory.models import InventoryItem
    #         inventory_identification_numbers = set(
    #             InventoryItem.objects.values_list('identification_number', flat=True)
    #         )
            
    #         print(f"📋 Found {len(inventory_identification_numbers)} unique identification_numbers in our inventory")
            
    #         # Process all items and get their offers, but only keep those that match inventory
    #         all_listings = []
    #         matched_skus = []
            
    #         for item in inventory_items:
    #             sku = item.get('sku')
    #             if not sku:
    #                 continue
                
    #             # ✅ FILTER: Only process if SKU exists in our inventory identification_numbers
    #             if sku not in inventory_identification_numbers:
    #                 continue
                    
    #             # Get offer for this SKU
    #             offer_data = self._get_offer_for_sku(sku)
                
    #             # Build combined listing data
    #             listing = self._build_combined_listing(item, offer_data)
                
    #             # Add inventory match information
    #             listing['inventory_match'] = {
    #                 'identification_number': sku,
    #                 'matched': True,
    #                 'inventory_item_exists': True
    #             }
                
    #             all_listings.append(listing)
    #             matched_skus.append(sku)
            
    #         # Build final response
    #         result = self._build_final_response(all_listings, inventory_items)
            
    #         # Add filtering summary
    #         result['filtering'] = {
    #             'total_ebay_items': len(inventory_items),
    #             'total_inventory_items': len(inventory_identification_numbers),
    #             'matched_items': len(matched_skus),
    #             'matched_skus': matched_skus,
    #             'filter_applied': 'identification_number = SKU'
    #         }
            
    #         print(f"✅ FILTERED: {len(matched_skus)} items matched with inventory")
    #         print("=" * 50)
            
    #         return result
            
    #     except Exception as e:
    #         print(f"❌ Error in combined tracking: {e}")
    #         return {'error': str(e)}


    def get_all_listings_with_availability(self) -> Optional[Dict[str, Any]]:
        """
        SINGLE API CALL: Get ALL listings with availability status
        NO FILTERING: Return all eBay listings regardless of inventory match
        """
        try:
            print("=" * 50)
            print("🚀 SINGLE CALL: GETTING ALL LISTINGS WITH AVAILABILITY (NO FILTERING)")
            print("=" * 50)
            
            # Single call to get inventory items with details
            url = f"{self.base_url}/sell/inventory/v1/inventory_item"
            params = {
                'limit': 200,
                'offset': 0
            }
            
            response = self._make_authenticated_request('GET', url, params=params, timeout=30)
            print(f"📦 Inventory API Response: {response.status_code}")
            
            if response.status_code != 200:
                return {'error': f'HTTP {response.status_code}: {response.text}'}
            
            inventory_data = response.json()
            inventory_items = inventory_data.get('inventoryItems', [])
            
            print(f"📊 Found {len(inventory_items)} inventory items from eBay")
            
            # 🆕 REMOVED: No more inventory filtering
            # Process ALL items and get their offers
            all_listings = []
            
            for item in inventory_items:
                sku = item.get('sku')
                if not sku:
                    continue
                    
                # 🆕 PROCESS ALL ITEMS - No filtering
                # Get offer for this SKU
                offer_data = self._get_offer_for_sku(sku)
                
                # Build combined listing data
                listing = self._build_combined_listing(item, offer_data)
                
                # 🆕 REMOVED: No inventory match data
                # Just add the basic listing
                all_listings.append(listing)
            
            # Build final response
            result = self._build_final_response(all_listings, inventory_items)
            
            # 🆕 REMOVED: No filtering summary
            print(f"✅ RETURNING ALL: {len(inventory_items)} eBay listings")
            print("=" * 50)
            
            return result
            
        except Exception as e:
            print(f"❌ Error in combined tracking: {e}")
            return {'error': str(e)}

    def _get_offer_for_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        """
        Internal method to get offer for a SKU
        """
        try:
            url = f"{self.base_url}/sell/inventory/v1/offer"
            params = {'sku': sku}
            
            response = self._make_authenticated_request('GET', url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('offers', [])[0] if data.get('offers') else None
            else:
                print(f"⚠️ No offer found for SKU: {sku}")
                return None
                
        except Exception as e:
            print(f"⚠️ Error getting offer for SKU {sku}: {e}")
            return None

    # def _build_combined_listing(self, inventory_item: Dict, offer_data: Optional[Dict]) -> Dict[str, Any]:
    #     """
    #     Build combined listing data from inventory and offer
    #     """
    #     sku = inventory_item.get('sku')
    #     product = inventory_item.get('product', {})
        
    #     # Base data from inventory
    #     listing = {
    #         'sku': sku,
    #         'inventory_details': {
    #             'title': product.get('title'),
    #             'description': product.get('description'),
    #             'condition': inventory_item.get('condition'),
    #             'image_urls': product.get('imageUrls', []),
    #             'aspects': product.get('aspects', {}),
    #             'created_date': inventory_item.get('createdDate'),
    #             'updated_date': inventory_item.get('updatedDate')
    #         }
    #     }
        
    #     # Add offer data if available
    #     if offer_data:
    #         listing.update({
    #             'offer_id': offer_data.get('offerId'),
    #             'listing_id': offer_data.get('listing', {}).get('listingId'),
    #             'listing_status': offer_data.get('listing', {}).get('listingStatus'),  # ACTIVE, ENDED
    #             'offer_status': offer_data.get('status'),  # PUBLISHED, DRAFT
    #             'available_quantity': offer_data.get('availableQuantity', 0),
    #             'sold_quantity': offer_data.get('listing', {}).get('soldQuantity', 0),
    #             'estimated_availability_status': 'IN_STOCK' if offer_data.get('availableQuantity', 0) > 0 else 'OUT_OF_STOCK',
    #             'price': offer_data.get('pricingSummary', {}).get('price', {}).get('value'),
    #             'currency': offer_data.get('pricingSummary', {}).get('price', {}).get('currency', 'USD'),
    #             'category_id': offer_data.get('categoryId'),
    #             'category_name': offer_data.get('categoryName'),
    #             'marketplace_id': offer_data.get('marketplaceId'),
    #             'format': offer_data.get('format'),
    #             'creation_date': offer_data.get('creationDate'),
    #             'modified_date': offer_data.get('lastModifiedDate'),
    #             'has_offer': True
    #         })
    #     else:
    #         listing.update({
    #             'has_offer': False,
    #             'listing_status': 'NO_OFFER',
    #             'offer_status': 'NOT_CREATED',
    #             'available_quantity': 0,
    #             'sold_quantity': 0,
    #             'estimated_availability_status': 'NOT_LISTED'
    #         })
        
    #     return listing


    def _build_combined_listing(self, inventory_item: Dict, offer_data: Optional[Dict]) -> Dict[str, Any]:
        """
        Build combined listing data from inventory and offer
        🆕 REMOVED: No inventory match information
        """
        sku = inventory_item.get('sku')
        product = inventory_item.get('product', {})
        
        # Base data from inventory
        listing = {
            'sku': sku,
            'inventory_details': {
                'title': product.get('title'),
                'description': product.get('description'),
                'condition': inventory_item.get('condition'),
                'image_urls': product.get('imageUrls', []),
                'aspects': product.get('aspects', {}),
                'created_date': inventory_item.get('createdDate'),
                'updated_date': inventory_item.get('updatedDate')
            }
        }
        
        # Add offer data if available
        if offer_data:
            listing.update({
                'offer_id': offer_data.get('offerId'),
                'listing_id': offer_data.get('listing', {}).get('listingId'),
                'listing_status': offer_data.get('listing', {}).get('listingStatus'),  # ACTIVE, ENDED
                'offer_status': offer_data.get('status'),  # PUBLISHED, DRAFT
                'available_quantity': offer_data.get('availableQuantity', 0),
                'sold_quantity': offer_data.get('listing', {}).get('soldQuantity', 0),
                'estimated_availability_status': 'IN_STOCK' if offer_data.get('availableQuantity', 0) > 0 else 'OUT_OF_STOCK',
                'price': offer_data.get('pricingSummary', {}).get('price', {}).get('value'),
                'currency': offer_data.get('pricingSummary', {}).get('price', {}).get('currency', 'USD'),
                'category_id': offer_data.get('categoryId'),
                'category_name': offer_data.get('categoryName'),
                'marketplace_id': offer_data.get('marketplaceId'),
                'format': offer_data.get('format'),
                'creation_date': offer_data.get('creationDate'),
                'modified_date': offer_data.get('lastModifiedDate'),
                'has_offer': True
            })
        else:
            listing.update({
                'has_offer': False,
                'listing_status': 'NO_OFFER',
                'offer_status': 'NOT_CREATED',
                'available_quantity': 0,
                'sold_quantity': 0,
                'estimated_availability_status': 'NOT_LISTED'
            })
        
        # 🆕 REMOVED: No inventory_match field
        return listing

    # def _build_final_response(self, all_listings: List[Dict], inventory_items: List[Dict]) -> Dict[str, Any]:
    #     """
    #     Build the final combined response structure
    #     """
    #     active_listings = [l for l in all_listings if l.get('listing_status') == 'ACTIVE']
    #     ended_listings = [l for l in all_listings if l.get('listing_status') == 'ENDED']
    #     listings_with_offers = [l for l in all_listings if l.get('has_offer')]
        
    #     return {
    #         'success': True,
    #         'summary': {
    #             'total_inventory_items': len(inventory_items),
    #             'total_listings': len(listings_with_offers),
    #             'active_listings': len(active_listings),
    #             'ended_listings': len(ended_listings),
    #             'items_without_offers': len(all_listings) - len(listings_with_offers)
    #         },
    #         'listings': all_listings,
    #         'availability_breakdown': {
    #             'in_stock': len([l for l in all_listings if l.get('estimated_availability_status') == 'IN_STOCK']),
    #             'out_of_stock': len([l for l in all_listings if l.get('estimated_availability_status') == 'OUT_OF_STOCK']),
    #             'not_listed': len([l for l in all_listings if l.get('estimated_availability_status') == 'NOT_LISTED'])
    #         },
    #         'timestamp': datetime.now().isoformat()
    #     }


    def _build_final_response(self, all_listings: List[Dict], inventory_items: List[Dict]) -> Dict[str, Any]:
        """
        Build the final combined response structure
        🆕 REMOVED: No inventory filtering stats
        """
        active_listings = [l for l in all_listings if l.get('listing_status') == 'ACTIVE']
        ended_listings = [l for l in all_listings if l.get('listing_status') == 'ENDED']
        listings_with_offers = [l for l in all_listings if l.get('has_offer')]
        
        return {
            'success': True,
            'summary': {
                'total_ebay_items': len(inventory_items),  # 🆕 Now shows ALL eBay items
                'total_listings': len(listings_with_offers),
                'active_listings': len(active_listings),
                'ended_listings': len(ended_listings),
                'items_without_offers': len(all_listings) - len(listings_with_offers)
            },
            'listings': all_listings,
            'availability_breakdown': {
                'in_stock': len([l for l in all_listings if l.get('estimated_availability_status') == 'IN_STOCK']),
                'out_of_stock': len([l for l in all_listings if l.get('estimated_availability_status') == 'OUT_OF_STOCK']),
                'not_listed': len([l for l in all_listings if l.get('estimated_availability_status') == 'NOT_LISTED'])
            },
            'timestamp': datetime.now().isoformat()
        }


    def auto_sync_listings(self) -> Dict[str, Any]:
        """
        AUTO SYNC: Automatically create eBay listings for unlisted inventory items
        Uses the same logic as manual listing creation
        """
        try:
            print("=" * 60)
            print("🔄 AUTO SYNC: Starting automatic listing creation")
            print("=" * 60)
            
            # Get unlisted inventory items
            from inventory.models import InventoryItem
            unlisted_items = InventoryItem.objects.filter(
                is_listed=False
            ).exclude(
                # Exclude items without cert_number (SKU)
                attributes__cert_number__isnull=True
            ).exclude(
                attributes__cert_number=''
            )[:20]  # Limit to 20 items per run to avoid rate limits
            
            print(f"📦 Found {len(unlisted_items)} unlisted items")
            
            if not unlisted_items:
                return {
                    'success': True,
                    'message': 'No unlisted items found',
                    'processed': 0,
                    'total_found': 0
                }
            
            processed_count = 0
            errors = []
            successful_listings = []
            
            for item in unlisted_items:
                try:
                    print(f"\n--- Processing Item: {item.name} ---")
                    
                    # Generate SKU from cert_number (same as frontend)
                    sku = item.attributes.get('cert_number', '')
                    if not sku:
                        errors.append(f"Item {item.id}: No cert_number available")
                        continue
                    
                    # Check if item already listed on eBay (same as frontend check)
                    existing_listing = self.get_all_listings_with_availability()
                    if existing_listing and 'listings' in existing_listing:
                        listing_exists = False
                        for listing in existing_listing['listings']:
                            if listing.get('sku') == sku:
                                # Item already listed, mark as listed and skip
                                item.is_listed = True
                                item.save()
                                print(f"✅ Item already listed on eBay - marked as listed")
                                listing_exists = True
                                processed_count += 1
                                break
                        
                        if listing_exists:
                            continue
                    
                    # Create listing using same logic as frontend
                    listing_result = self._create_auto_listing(item, sku)
                    
                    if listing_result['success']:
                        processed_count += 1
                        successful_listings.append({
                            'item_id': item.id,
                            'name': item.name,
                            'listing_id': listing_result.get('listing_id'),
                            'sku': sku
                        })
                        print(f"✅ Successfully listed: {item.name}")
                    else:
                        errors.append(f"Item {item.id}: {listing_result.get('error')}")
                        print(f"❌ Failed to list: {item.name} - {listing_result.get('error')}")
                        
                except Exception as e:
                    error_msg = f"Item {item.id}: {str(e)}"
                    errors.append(error_msg)
                    print(f"❌ Error processing item {item.id}: {e}")
                    continue
            
            # Build result summary
            result = {
                'success': True,
                'processed': processed_count,
                'total_found': len(unlisted_items),
                'successful_listings': successful_listings,
                'errors': errors,
                'message': f"Auto sync completed - {processed_count}/{len(unlisted_items)} items processed"
            }
            
            print(f"\n🎯 AUTO SYNC COMPLETE:")
            print(f"   ✅ Successful: {processed_count}")
            print(f"   ❌ Errors: {len(errors)}")
            print(f"   📊 Total Found: {len(unlisted_items)}")
            print("=" * 60)
            
            return result
            
        except Exception as e:
            print(f"❌ AUTO SYNC FAILED: {e}")
            return {
                'success': False,
                'error': str(e),
                'processed': 0,
                'total_found': 0
            }

    def _create_auto_listing(self, item, sku: str) -> Dict[str, Any]:
        """
        Create eBay listing for an inventory item - SAME LOGIC AS FRONTEND
        """
        try:
            # Generate title (same as frontend generateEbayTitle)
            title = item.name
            if len(title) > 75:
                title = title[:72] + "..."
            
            # Use inventory price as starting price (same as frontend)
            starting_price = float(item.price)
            # Buy It Now price 10% higher (same as frontend)
            buy_it_now_price = starting_price * 1.1
            
            # Transform attributes to eBay aspects (same as frontend transformAttributes)
            aspects = self._transform_auto_attributes(item.attributes or {})
            
            # Get image URLs (same as frontend)
            image_urls = []
            if hasattr(item, 'images') and item.images:
                for img in item.images:
                    # Handle different image field structures
                    url = None
                    if hasattr(img, 'front_url'):
                        url = img.front_url
                    elif hasattr(img, 'rear_url'):
                        url = img.rear_url  
                    elif hasattr(img, 'url'):
                        url = img.url
                    elif isinstance(img, dict):
                        url = img.get('front_url') or img.get('rear_url') or img.get('url')
                    elif isinstance(img, str):
                        url = img
                    
                    if url and url not in image_urls:
                        image_urls.append(url)
            
            print(f"   📝 Title: {title}")
            print(f"   💰 Price: ${buy_it_now_price:.2f} (from ${starting_price:.2f} + 10%)")
            print(f"   🏷️  SKU: {sku}")
            print(f"   📸 Images: {len(image_urls)}")
            print(f"   🔧 Aspects: {len(aspects)} attributes")
            
            # Prepare listing data (same structure as frontend EbayListingPayload)
            listing_data = {
                'sku': sku,
                'title': title,
                'description': item.description or 'Collectible item in excellent condition',
                'price': buy_it_now_price,
                'quantity': 1,
                'category_id': '102504',  # Default coin category (same as frontend)
                'image_urls': image_urls,
                'aspects': aspects,
                'currency': 'USD',
                'listing_duration': 'GTC',  # Good 'Til Cancelled (same as frontend)
                'inventory_item_id': str(item.id)
            }
            
            # Create the listing using existing method
            result = self.create_complete_listing(listing_data)
            
            if 'error' in result:
                return {'success': False, 'error': result['error']}
            
            # Mark item as listed (same as frontend)
            item.is_listed = True
            item.save()
            
            return {
                'success': True, 
                'listing_id': result.get('listing_id'),
                'offer_id': result.get('offer_id'),
                'listing_url': result.get('listing_url')
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _transform_auto_attributes(self, attributes: Dict) -> Dict[str, List[str]]:
        """
        Transform inventory attributes to eBay aspects - SAME LOGIC AS FRONTEND
        """
        if not attributes or not isinstance(attributes, dict):
            return {}
        
        aspects = {}
        
        # Grade attributes (same as frontend)
        if attributes.get('grade'):
            grade = attributes['grade']
            if isinstance(grade, dict):
                if grade.get('service'): 
                    aspects["Certification"] = [grade['service']]
                if grade.get('label'): 
                    aspects["Grade"] = [grade['label']]
                if grade.get('display'): 
                    aspects["Grade Description"] = [grade['display']]
                if grade.get('comment'): 
                    aspects["Comments"] = [grade['comment']]
        
        # Coin attributes (same as frontend)
        if attributes.get('coin'):
            coin = attributes['coin']
            if isinstance(coin, dict):
                if coin.get('year'): 
                    aspects["Year"] = [str(coin['year'])]
                if coin.get('mint_mark'): 
                    aspects["Mint Mark"] = [coin['mint_mark']]
                if coin.get('denomination'): 
                    aspects["Denomination"] = [coin['denomination']]
                if coin.get('variety'): 
                    aspects["Variety"] = [coin['variety']]
                if coin.get('metal_type'): 
                    aspects["Metal Type"] = [coin['metal_type']]
                if coin.get('fineness'): 
                    aspects["Fineness"] = [str(coin['fineness'])]
        
        # Direct attributes (same as frontend)
        if attributes.get('cert_number'): 
            aspects["Certification Number"] = [attributes['cert_number']]
        if attributes.get('year'): 
            aspects["Year"] = [str(attributes['year'])]
        if attributes.get('mint_mark'): 
            aspects["Mint Mark"] = [attributes['mint_mark']]
        if attributes.get('denomination'): 
            aspects["Denomination"] = [attributes['denomination']]
        if attributes.get('variety'): 
            aspects["Variety"] = [attributes['variety']]
        if attributes.get('metal_type'): 
            aspects["Metal Type"] = [attributes['metal_type']]
        
        # Metadata attributes (same as frontend)
        if attributes.get('metadata'):
            metadata = attributes['metadata']
            if isinstance(metadata, dict):
                if metadata.get('encapsulation_date'): 
                    aspects["Encapsulation Date"] = [metadata['encapsulation_date']]
                if metadata.get('graded_date'): 
                    aspects["Graded Date"] = [metadata['graded_date']]
        
        print(f"   🔧 Transformed {len(aspects)} aspects: {list(aspects.keys())}")
        return aspects