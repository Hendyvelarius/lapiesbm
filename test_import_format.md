# Bahan Baku Import Format - New Implementation

## 📋 Changes Made

### 1. Excel Sheet Selection Logic
- **Primary**: Looks for sheet named "First Sheet"
- **Fallback**: Uses the first/active sheet if "First Sheet" doesn't exist
- **Header Handling**: Always skips row 1 (reserved for column names)

### 2. New Column Mapping (Bahan Baku Import)

| Column | Field | Description | Validation |
|--------|--------|-------------|------------|
| A | Item Type | Must be "Bahan Baku" exactly | ✅ Required - Case insensitive |
| B | Item ID | Unique identifier | ✅ Required |
| E | Item PRC ID | Principle code | ❌ Optional |
| AB | Purchase Unit | Unit of measurement | ⚠️ Validates format |
| AD | Currency | Currency code | ❌ Optional |
| AE | Purchase Price | Standard price | ⚠️ Auto-converts to 0 if invalid |

### 3. Data Processing Features

#### Price Validation
- **Invalid/Null Prices**: Automatically set to `0`
- **Non-numeric Values**: Converted to `0`
- **Negative Values**: Converted to `0`

#### Unit Validation System
- **Invalid Units Detected**: 
  - Pure numbers (e.g., "123")
  - Null/empty values
  - "null", "undefined" strings
- **Warning System**: Invalid units highlighted in preview
- **Status**: Items with invalid units marked as "Needs Review"

#### Type Validation
- **Strict Validation**: Only "Bahan Baku" entries processed
- **Case Insensitive**: "bahan baku", "BAHAN BAKU" accepted
- **Auto-Conversion**: "Bahan Baku" → "BB" for database

### 4. Enhanced Import Preview

#### Visual Indicators
- **🔄 Duplicate (Selected)**: Highest priced item chosen
- **⚠️ Needs Review**: Invalid unit or zero price
- **✅ Valid**: Clean data ready for import

#### Color Coding
- **Yellow Background**: Items with validation issues
- **Red Text**: Invalid units
- **Orange Text**: Zero prices

#### Warning Summary
- Count of invalid units
- Count of zero prices
- Duplicate resolution status

### 5. Existing Logic Preserved
- **Duplicate Handling**: Still uses highest price selection
- **Currency Conversion**: Maintains existing normalization
- **Code Normalization**: Still removes `.000` patterns
- **Batch Processing**: All existing calculation logic intact

## 🔧 Sample Excel Format

```
Row 1: [Headers - Ignored]
Row 2: Bahan Baku | AC001 | ... | ... | 00041 | ... | kg | IDR | 4.8
Row 3: Bahan Baku | AC002 | ... | ... | 00042 | ... | pcs | USD | 2.5
```

## 🚨 Validation Results

### Valid Entry Example
```json
{
  "ITEM_ID": "AC001",
  "ITEM_TYPE": "BB", 
  "ITEM_PURCHASE_UNIT": "kg",
  "ITEM_PURCHASE_STD_PRICE": 4.8,
  "ITEM_CURRENCY": "IDR",
  "ITEM_PRC_ID": "00041"
}
```

### Invalid Unit Handling
```json
{
  "ITEM_ID": "AC002",
  "ITEM_TYPE": "BB",
  "ITEM_PURCHASE_UNIT": null, // Was "123" (pure number)
  "ITEM_PURCHASE_STD_PRICE": 0, // Was null/invalid
  "hasInvalidUnit": true,
  "hasZeroPrice": true
}
```

## ✅ Testing Checklist

- [x] Sheet selection logic ("First Sheet" priority)
- [x] Header row skipping (row 1 ignored)
- [x] Column mapping (A, B, E, AB, AD, AE)
- [x] Price validation (null → 0)
- [x] Unit validation (number/null detection)
- [x] Type validation ("Bahan Baku" only)
- [x] Visual warnings in preview
- [x] Existing duplicate handling preserved
- [x] Database field mapping maintained

The system now provides comprehensive validation while maintaining all existing processing logic for duplicates, currency conversion, and data normalization.