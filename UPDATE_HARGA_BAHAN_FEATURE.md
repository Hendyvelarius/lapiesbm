# Update Harga Bahan Feature - Phase 1 Implementation

## Overview
Implemented a new "Update Harga Bahan" feature in the HargaBahan page that allows users to select multiple materials and update their prices for a specific year (Periode).

## Implementation Details

### 1. New UI Button
- **Location**: Between "Export" and "Tambah Bahan" buttons in the controls section
- **Icon**: DollarSign (from lucide-react)
- **Styling**: Orange gradient (`#f59e0b` to `#d97706`) with hover effects

### 2. State Management
Added the following state variables:
```javascript
const [showUpdateHargaModal, setShowUpdateHargaModal] = useState(false);
const [selectedMaterialsForUpdate, setSelectedMaterialsForUpdate] = useState([]);
const [updatePeriode, setUpdatePeriode] = useState(new Date().getFullYear().toString());
const [updateMaterialsData, setUpdateMaterialsData] = useState([]);
const [updateSearchTerm, setUpdateSearchTerm] = useState('');
```

### 3. Modal Interface
The modal includes:

#### a) Year Selector Section
- Dropdown to select the year (Periode) for price updates
- Visual warning when selected year differs from current view
- Uses existing `generateYearOptions()` function (current year ± 2)

#### b) Material Selection Section
- Search box for filtering materials by ID or name
- List of all materials from current `materialData`
- Checkbox selection interface
- Shows current price for each material
- Visual highlighting for selected materials

#### c) Selected Materials Summary Section
- Displays all selected materials in expandable cards
- Each card shows:
  - Material ID (as badge) and Name
  - Current price with currency
  - Remove button to deselect
  - Adjustment type selector (radio buttons):
    - **New Price Amount**: Direct price input
    - **Percentage Change**: Percentage-based adjustment
  - Dynamic price input based on adjustment type:
    - For "New Price Amount": Currency-prefixed input field
    - For "Percentage Change": Percentage input with real-time calculation display

### 4. Features Implemented

#### Price Adjustment Options
1. **New Price Amount Mode**
   - Direct input of new price value
   - Currency prefix display (e.g., "IDR")
   - Validates minimum value of 0

2. **Percentage Change Mode**
   - Input percentage change (positive or negative)
   - Real-time calculation of new price
   - Shows calculated result immediately
   - Example: +10% or -5%

#### Material Selection
- Multi-select with checkbox interface
- Visual feedback for selected items (blue gradient background)
- Search functionality to filter materials
- Click-to-select/deselect toggle behavior

#### Validation & UX
- Disable "Continue" button when no materials selected
- Warning display when updating different year than currently viewed
- Clean, modern UI with gradient backgrounds and shadows
- Smooth transitions and hover effects

### 5. Files Modified

#### Frontend
1. **`frontend/src/pages/HargaBahan.jsx`**
   - Added DollarSign icon import
   - Added state variables for update modal
   - Added `handleUpdateHargaBahan()` function
   - Added "Update Harga Bahan" button in controls section
   - Added complete UpdateHargaBahanModal component with all functionality
   - Lines added: ~250+ (modal component and logic)

2. **`frontend/src/styles/HargaBahan.css`**
   - Added `.update-harga-btn` styles (orange gradient button)
   - Added comprehensive modal styles:
     - `.update-harga-modal` - modal container
     - `.update-year-section` - year selector section
     - `.material-selection-section` - material list section
     - `.selected-materials-section` - selected materials cards
     - `.price-adjustment-section` - price input controls
     - Multiple helper classes for inputs, labels, badges
   - Lines added: ~400+

### 6. Technical Architecture

#### Data Flow
1. User clicks "Update Harga Bahan" button
2. Modal opens with `updatePeriode` initialized to `selectedPeriode`
3. User selects year (if different from current view)
4. User searches and selects materials from the full list
5. For each selected material:
   - Material object copied with additional fields:
     - `newPrice`: Initially set to current price
     - `adjustmentType`: 'amount' or 'percentage'
     - `adjustmentValue`: The adjustment value (0 initially)
6. User chooses adjustment type and enters value
7. State updates in real-time for percentage calculations
8. "Continue" button (Phase 2 placeholder) currently shows info notification

#### Key Props Tracked
Each selected material stores:
```javascript
{
  ...material,           // Original material data
  newPrice: number,      // Calculated or input new price
  adjustmentType: string, // 'amount' or 'percentage'
  adjustmentValue: number // 0 for amount, percentage for percentage type
}
```

### 7. Responsive Design
- Modal width: 90vw, max-width 1200px
- Max height: 90vh with scrollable body
- Materials list: max-height 400px with scroll
- Mobile-friendly with proper spacing and sizing

### 8. Phase 1 Scope (Completed) ✅
- [x] UI button creation
- [x] Modal design and layout
- [x] Year (Periode) selector
- [x] Material search functionality
- [x] Material multi-select interface
- [x] Current price display
- [x] Price adjustment input (both modes)
- [x] Real-time price calculation for percentage mode
- [x] Selected materials management (add/remove)
- [x] Complete CSS styling
- [x] Form validation (disable button when no selection)

### 9. Phase 2 Requirements (Future)
- [ ] API endpoint for bulk price update
- [ ] Backend stored procedure for price updates
- [ ] "Affected Products" calculation (similar to Price Change simulation)
- [ ] Show which products use the selected materials
- [ ] Calculate cost impact on each affected product
- [ ] Before/After comparison view
- [ ] PDF export of price update report
- [ ] Save price update to database
- [ ] Update confirmation workflow
- [ ] Audit trail for price changes

### 10. Integration Points
- Uses existing `materialData` from parent component
- Uses existing `selectedPeriode` as default for `updatePeriode`
- Compatible with existing notification system (AWN)
- Uses existing CSS variable patterns
- Follows existing modal structure patterns

### 11. Code Quality
- No ESLint errors
- No CSS syntax errors
- Consistent naming conventions
- Proper state management
- Clean separation of concerns
- Reusable component structure

## Usage Instructions

1. Navigate to HargaBahan page
2. Select the year you want to view/update
3. Click "Update Harga Bahan" button (orange, between Export and Tambah Bahan)
4. In the modal:
   - Confirm or change the year for updates
   - Search for materials using the search box
   - Click on materials to select them (checkbox interface)
   - For each selected material:
     - Choose adjustment type (New Price Amount or Percentage Change)
     - Enter the new value
     - See real-time calculation for percentage changes
   - Remove any material by clicking the X button on its card
5. Click "Continue" (currently placeholder for Phase 2)

## Visual Design
- **Button Color**: Orange gradient (matches update/warning theme)
- **Modal Theme**: Blue and yellow accents
- **Selected Materials**: Blue gradient backgrounds
- **Price Inputs**: Clean white with gray borders, blue focus states
- **Current Prices**: Green text for easy recognition
- **Warnings**: Yellow background with orange border

## Performance Considerations
- Materials list uses filter for search (instant response)
- State updates are optimized with proper React patterns
- No unnecessary re-renders
- Efficient array operations for selection management

## Testing Checklist
- [ ] Button appears in correct location
- [ ] Modal opens/closes properly
- [ ] Year selector works
- [ ] Warning shows when year differs
- [ ] Material search filters correctly
- [ ] Material selection/deselection works
- [ ] Price adjustment toggles between modes
- [ ] Percentage calculation is accurate
- [ ] Remove material button works
- [ ] Continue button disables when no selection
- [ ] Responsive design on different screen sizes

## Future Enhancements (Phase 2+)
1. **Affected Products Analysis**
   - Query database for products using selected materials
   - Calculate cost impact per product
   - Show before/after comparison
   - Group by product type (Ethical, Generik1, Generik2)

2. **Batch Update Workflow**
   - Validation before saving
   - Transaction support for atomic updates
   - Rollback capability
   - Success/error reporting

3. **Reporting & Export**
   - PDF export of price update summary
   - Affected products report
   - Historical price tracking
   - Change audit log

4. **Advanced Features**
   - Bulk percentage adjustment (apply same % to all)
   - Price update templates
   - Schedule future price updates
   - Multi-currency adjustments with rate updates
   - Import price updates from Excel

## Notes
- Implementation follows existing code patterns from HargaBahan page
- Modal structure similar to import/export modals
- Price adjustment logic prepared for future backend integration
- Periode awareness ensures data integrity across years
