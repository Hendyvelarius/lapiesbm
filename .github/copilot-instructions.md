# eSBM (e-Sistem Biaya Manufaktur) - AI Coding Guide

## Project Overview
Manufacturing Cost System built with React frontend (Vite) and Node.js backend using SQL Server. Main domain: cost calculation (HPP), material pricing, formulas, and manufacturing cost allocations.

## Architecture & Key Concepts

### Frontend Structure (React + Vite)
- **Single-page application** with React Router for navigation
- **No TypeScript** - pure JavaScript with JSX
- **Pages-based routing**: Each business function is a separate page component
- **Shared layout**: `TopNavbar` + `Sidebar` + main content area
- **API service layer**: Centralized in `src/services/api.js` with grouped APIs (`productsAPI`, `masterAPI`, `hppAPI`)

### Backend Structure (Node.js + Express)
- **MVC pattern**: Routes → Controllers → Models → SQL Server
- **Direct SQL queries**: No ORM, using `mssql` package with stored procedures and views
- **Modular routing**: Feature-based route groupings (`/api/products`, `/api/master`, `/api/hpp`)
- **SQL Server integration**: Views prefixed `vw_COGS_*`, tables `M_COGS_*`, procedures `sp_COGS_*`

## Database Patterns

### Key SQL Server Conventions
```sql
-- Views: vw_COGS_* (e.g., vw_COGS_Currency_List)
-- Tables: M_COGS_* (e.g., M_COGS_STD_HRG_BAHAN)
-- Stored Procedures: sp_COGS_* (e.g., sp_COGS_generate_all_formula_detail)
```

### Critical Data Models
- **Materials**: `M_COGS_STD_HRG_BAHAN` for material pricing
- **Formulas**: `M_COGS_FORMULA_MANUAL` for recipe definitions  
- **Groups**: `M_COGS_PRODUCT_GROUP_MANUAL` for product categorization
- **Parameters**: `M_COGS_STD_PARAMETER` for calculation constants

## API Patterns

### Request/Response Structure
```javascript
// Standard error handling in controllers
try {
    const result = await modelFunction();
    res.status(200).json(result);
} catch (error) {
    res.status(500).json({
        success: false,
        message: 'Failed to...',
        error: error.message
    });
}
```

### Frontend API Service Pattern
```javascript
// Centralized API calls in api.js
const apiRequest = async (endpoint, options) => {
    // Generic fetch wrapper with error handling
};

export const masterAPI = {
    getCurrency: () => apiRequest('/master/currency'),
    bulkImportBahanBaku: (items) => apiRequest('/master/hargaBahan/bulk-import-bahan-baku', {
        method: 'POST',
        body: JSON.stringify({ items }),
    }),
};
```

## Development Workflows

### Backend Development
```bash
cd backend
npm run dev  # nodemon for auto-restart
```

### Frontend Development  
```bash
cd frontend
npm run dev  # Vite dev server
```

### Environment Configuration
- Backend uses `.env` for SQL Server connection
- Frontend uses `VITE_API_BASE_URL` environment variable
- Default API base: `http://localhost:3100/api`

## Component Patterns

### Page Components
- **Comprehensive CRUD operations**: Most pages handle full Create/Read/Update/Delete cycles
- **Excel import functionality**: Many pages support bulk import from Excel files using `xlsx` package
- **Pagination**: Custom pagination logic (not using libraries)
- **Modal-based forms**: Add/Edit operations in overlay modals
- **Notification system**: Using `awesome-notifications` for user feedback

### State Management
- **Local component state**: No Redux/Context API - each page manages own state
- **API integration**: Direct fetch calls from components to API services
- **Loading states**: Explicit loading indicators for async operations

## Business Logic Specifics

### HPP (Cost) Calculation
- **Three calculation types**: Ethical, Generik1, Generik2 products
- **Simulation mode**: Test formulas before applying
- **Formula assignment**: Auto-assignment based on cost optimization
- **Material conversion**: Complex unit conversions (kg ↔ liter using specific gravity)

### Excel Import Processing
- **Duplicate detection**: Normalize codes (remove `.000` suffixes) and select highest-priced items
- **Column mapping**: Dynamic column detection by header names
- **Batch processing**: Handle large datasets with pagination
- **Validation**: Type checking (only BB/Bahan Baku items allowed for certain imports)

## Styling & UI
- **CSS Modules approach**: Each page has corresponding `.css` file in `src/styles/`
- **Lucide React icons**: Consistent icon library across components
- **Custom styling**: No UI framework - custom CSS with BEM-like conventions

## Error Handling Best Practices
- **Backend**: Always wrap database operations in try-catch
- **Frontend**: User-friendly error messages via notifications
- **Validation**: Both client and server-side validation for critical operations
- **SQL errors**: Proper SQL Server error handling with meaningful messages

## Testing & Debugging
- **Console logging**: Extensive logging in both frontend and backend
- **API testing**: Built-in health check endpoint `/api/health`
- **SQL debugging**: Direct query execution logging in models
- **Network inspection**: Use browser DevTools for API request debugging