# NGC Certificate Workflow

This document outlines the workflow for adding NGC certified coins to the inventory system, both through barcode scanning and manual entry.

## Workflow Steps

1. **Certificate Entry**
   - **Barcode Scanner**: User scans the barcode on an NGC slab using the device camera
   - **Manual Entry**: User types in the NGC certificate number manually
   - Both methods retrieve data from the NGC API

2. **Data Preview**
   - NGC data is displayed in a preview modal showing:
     - Coin images (obverse and reverse)
     - Certificate details (number, grade, date)
     - Coin details (year, denomination, variety, metal type)
   - User can click on images to enlarge them

3. **Handling Options**
   - **For New Items**:
     - "Edit Details First": Redirects to inventory management with pre-filled data
     - "Confirm & Save Item": Prompts for name confirmation, then saves directly
   - **For Existing Items (Duplicates)**:
     - "Edit Details First": Shows an AlertDialog confirming redirect to inventory
     - No "Confirm & Save" option is shown for duplicates

4. **Duplicate Handling**
   - When a certificate already exists in inventory:
     - System identifies it as a duplicate
     - Shows a warning message in the preview modal
     - Only allows editing the existing item (no duplicate saving)
     - Redirects to inventory search with the certificate number when "Edit Details First" is clicked

5. **Success Confirmation**
   - After successful save, a confirmation dialog is shown
   - User can click "Done" to close the modal

## Implementation Details

- Both barcode scanner and manual entry use the same preview modal and workflow
- Duplicate detection happens at the API level during certificate lookup
- The `NGCDataPreviewModal` component handles both new items and duplicates
- AlertDialog is used for confirmation instead of native browser dialogs

## User Experience Improvements

- Consistent workflow between barcode scanner and manual entry
- Clear visual indicators for duplicate items
- Modern dialog components for better UI consistency
- Proper redirection to inventory for existing items
