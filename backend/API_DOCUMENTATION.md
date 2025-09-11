# eSBM API Documentation

## Overview
This is the backend API for the e-Sistem Biaya Manufaktur (Manufacturing Cost System) application.

## Base URL
```
Development: http://localhost:3100
```

## Authentication
Currently, the API does not require authentication, but middleware is prepared for future implementation.

## API Endpoints

### Health Check
- **GET** `/health` - Check server status

### Products API

#### Get All Products
- **GET** `/api/products`
- **Query Parameters:**
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 10)
  - `search` (string): Search by product name
  - `jenisProduk` (string): Filter by product type
  - `kategori` (string): Filter by category

#### Get Product by ID
- **GET** `/api/products/:id`

#### Create Product
- **POST** `/api/products`
- **Body:**
```json
{
  "namaProduk": "Product Name",
  "harga": 100000,
  "jenisProduk": "Type",
  "bentuk": "Form",
  "kategori": "Category",
  "pabrik": "Factory",
  "expiry": "2024-12-31"
}
```

#### Update Product
- **PUT** `/api/products/:id`
- **Body:** Same as create product

#### Delete Product
- **DELETE** `/api/products/:id`

### Formula API

#### Get All Formulas
- **GET** `/api/products/formula`
- **Description:** Get all existing formulas for all products from vw_COGS_FORMULA_List

#### Get Formula by Product ID
- **GET** `/api/products/formula/:id`
- **Description:** Get formulas for a specific product

#### Get All Formula Details
- **GET** `/api/products/formula-details`
- **Description:** Get comprehensive formula details including ingredients, batch sizes, and pricing from vw_COGS_FORMULA_List_detail
- **Response Example:**
```json
[
  {
    "Product_ID": "L5",
    "Product_Name": "MELOXICAM-7.5 TABLET (GENERIK)",
    "PPI_SubID": "A",
    "TypeName": "2. KEMAS PRIMER",
    "TypeCode": "KP",
    "Source": "ePengembanganFormula",
    "BatchSize": 2000,
    "Default": "Aktif",
    "PPI_SeqID": 1,
    "PPI_ItemID": "A 201",
    "PPI_UnitID": "roll",
    "PPI_QTY": "1",
    "UnitPrice": 3650000,
    "PurchaseQTYUnit": 1,
    "PurchaseUnit": "roll",
    "DefaultCOGS": "Aktif"
  }
]
```

#### Get Active Formula Details
- **GET** `/api/products/formula-details/active`
- **Description:** Get formula details only for active formulas (DefaultCOGS = 'Aktif')
- **Response:** Same format as above, but filtered for active formulas only

#### Get Chosen Formulas
- **GET** `/api/products/chosenformula`
- **Description:** Get all chosen/assigned formulas from M_COGS_PRODUCT_FORMULA_FIX

#### Create Chosen Formula
- **POST** `/api/products/chosenformula`
- **Body:**
```json
{
  "productId": "L5",
  "pi": "A",
  "ps": "B",
  "kp": "C",
  "ks": "D",
  "stdOutput": 2000
}
```

#### Update Chosen Formula
- **PUT** `/api/products/chosenformula/:productId`
- **Body:** Same as create chosen formula

#### Delete Chosen Formula
- **DELETE** `/api/products/chosenformula/:productId`

#### Get Recipe Details
- **GET** `/api/products/recipe/:productId`
- **Description:** Get detailed recipe/formula information for a specific product

### HPP (Cost of Goods Sold) API

#### Get All HPP Records
- **GET** `/api/hpp`
- **Query Parameters:**
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 10)
  - `productId` (number): Filter by product ID
  - `status` (string): Filter by status (draft, confirmed, archived)

#### Get HPP by ID
- **GET** `/api/hpp/:id`

#### Create HPP
- **POST** `/api/hpp`
- **Body:**
```json
{
  "productId": 1,
  "biayaTenagaKerja": 50000,
  "biayaOverhead": 30000,
  "notes": "Optional notes",
  "ingredients": [
    {
      "namaBahan": "Ingredient Name",
      "jumlah": 10,
      "satuan": "kg",
      "hargaSatuan": 5000,
      "supplier": "Supplier Name",
      "tanggalPembelian": "2024-01-15",
      "nomorBatch": "BATCH001",
      "kadaluarsa": "2024-12-31",
      "notes": "Ingredient notes"
    }
  ]
}
```

#### Update HPP Status
- **PATCH** `/api/hpp/:id/status`
- **Body:**
```json
{
  "status": "confirmed",
  "confirmedBy": "User Name"
}
```

#### Delete HPP
- **DELETE** `/api/hpp/:id` (Only draft status)

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

## Status Codes
- **200** - Success
- **201** - Created
- **400** - Bad Request
- **404** - Not Found
- **500** - Internal Server Error

## Data Models

### Product
```json
{
  "id": 1,
  "namaProduk": "Product Name",
  "harga": 100000,
  "jenisProduk": "Type",
  "bentuk": "Form",
  "kategori": "Category",
  "pabrik": "Factory",
  "expiry": "2024-12-31",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### HPP
```json
{
  "id": 1,
  "productId": 1,
  "biayaTenagaKerja": 50000,
  "biayaOverhead": 30000,
  "totalBahanBaku": 50000,
  "totalHPP": 130000,
  "status": "draft",
  "confirmedAt": null,
  "confirmedBy": null,
  "notes": "Notes",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### HPP Ingredient
```json
{
  "id": 1,
  "hppId": 1,
  "namaBahan": "Ingredient Name",
  "jumlah": 10,
  "satuan": "kg",
  "hargaSatuan": 5000,
  "totalHarga": 50000,
  "supplier": "Supplier Name",
  "tanggalPembelian": "2024-01-15",
  "nomorBatch": "BATCH001",
  "kadaluarsa": "2024-12-31",
  "notes": "Notes",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```
