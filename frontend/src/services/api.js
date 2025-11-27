// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Products API
export const productsAPI = {
  // Get all products
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/products${queryString ? `?${queryString}` : ''}`);
  },

  // Get product by ID
  getById: (id) => apiRequest(`/products/${id}`),

  // Create new product
  create: (productData) => apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),

  // Update product
  update: (id, productData) => apiRequest(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  }),

  // Delete product
  delete: (id) => apiRequest(`/products/${id}`, {
    method: 'DELETE',
  }),

  // Get formula data (available formulas)
  getFormula: () => apiRequest('/products/formula'),
  
  // Get formula by ID
  getFormulaById: (id) => apiRequest(`/products/formula/${id}`),
  
  // Get all formula details (comprehensive formula information)
  getAllFormulaDetails: () => apiRequest('/products/formula-details'),
  
  // Get active formula details only (DefaultCOGS = 'Aktif')
  getActiveFormulaDetails: () => apiRequest('/products/formula-details/active'),
  
  // Get chosen formula data (current product-formula assignments)
  getChosenFormula: (periode = null) => {
    const url = periode ? `/products/chosenformula?periode=${periode}` : '/products/chosenformula';
    return apiRequest(url);
  },
  
  // Get available years from formula assignments
  getAvailableYears: () => apiRequest('/products/available-years'),
  
  // Add chosen formula
  addChosenFormula: (data) => apiRequest('/products/chosenformula', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Update chosen formula
  updateChosenFormula: (productId, data) => apiRequest(`/products/chosenformula/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete chosen formula
  deleteChosenFormula: (productId, periode = null) => {
    const url = periode ? `/products/chosenformula/${productId}?periode=${periode}` : `/products/chosenformula/${productId}`;
    return apiRequest(url, {
      method: 'DELETE',
    });
  },
  
  // Get recipe by product ID
  getRecipe: (productId) => apiRequest(`/products/recipe/${productId}`),
  
  // Get formula product cost for auto assignment
  getFormulaProductCost: () => apiRequest('/products/formula-cost'),
  
  // Auto assign formulas based on cost analysis
  autoAssignFormulas: () => apiRequest('/products/auto-assign-formulas', {
    method: 'POST',
  }),
  
  // Get formula recommendations for a specific product
  getFormulaRecommendations: (productId) => apiRequest(`/products/formula-recommendations/${productId}`),
  
  // Bulk import formula assignments
  bulkImportFormulas: (data) => apiRequest('/products/bulk-import-formulas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Generate HPP for a specific product
  generateHPP: (productId) => apiRequest(`/products/generate-hpp/${productId}`, {
    method: 'POST',
  }),
  
  // Lock/unlock year
  lockYear: (periode, isLock) => apiRequest('/products/lock-year', {
    method: 'POST',
    body: JSON.stringify({ periode, isLock }),
  }),
  
  // Lock/unlock individual product
  lockProduct: (productId, periode, isLock) => apiRequest('/products/lock-product', {
    method: 'POST',
    body: JSON.stringify({ productId, periode, isLock }),
  }),
};

// HPP API
export const hppAPI = {
  // Get HPP calculation results (three tables: ethical, generik1, generik2)
  getResults: (year = null) => {
    const queryString = year ? `?year=${year}` : '';
    return apiRequest(`/hpp/data${queryString}`);
  },

  // Generate HPP calculation
  generateCalculation: (periode) => apiRequest('/hpp/generate', {
    method: 'POST',
    body: JSON.stringify({ periode }),
  }),

  // Generate HPP simulation for existing product with selected formulas
  generateSimulation: (productId, formulaString) => apiRequest('/hpp/simulate-existing', {
    method: 'POST',
    body: JSON.stringify({ productId, formulaString }),
  }),

  // Get simulation header details by Simulasi_ID
  getSimulationHeader: (simulasiId) => apiRequest(`/hpp/simulation/${simulasiId}/header`),

  // Get simulation detail materials by Simulasi_ID
  getSimulationDetailBahan: (simulasiId) => apiRequest(`/hpp/simulation/${simulasiId}/detail-bahan`),

  // Save simulation (update header and replace materials)
  saveSimulation: (simulasiId, headerData, materials) => apiRequest('/hpp/simulation/save', {
    method: 'PUT',
    body: JSON.stringify({ simulasiId, headerData, materials }),
  }),

  // Create custom simulation (new simulation with custom product/formula name)
  createCustomSimulation: (headerData, materials) => apiRequest('/hpp/simulation/create-custom', {
    method: 'POST',
    body: JSON.stringify({ headerData, materials }),
  }),

  // Clone simulation (duplicate existing simulation)
  cloneSimulation: (simulasiId, cloneDescription) => apiRequest(`/hpp/simulation/clone/${simulasiId}`, {
    method: 'POST',
    body: JSON.stringify({ cloneDescription }),
  }),

  // Get list of all simulation records
  getSimulationList: () => apiRequest('/hpp/simulation/list'),

  // Delete simulation by Simulasi_ID
  deleteSimulation: (simulasiId) => apiRequest(`/hpp/simulation/${simulasiId}`, {
    method: 'DELETE',
  }),

  // Get all HPP records
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/hpp${queryString ? `?${queryString}` : ''}`);
  },

  // Get HPP by ID
  getById: (id) => apiRequest(`/hpp/${id}`),

  // Create new HPP with ingredients
  create: (hppData) => apiRequest('/hpp', {
    method: 'POST',
    body: JSON.stringify(hppData),
  }),

  // Update HPP status
  updateStatus: (id, statusData) => apiRequest(`/hpp/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(statusData),
  }),

  // Delete HPP
  delete: (id) => apiRequest(`/hpp/${id}`, {
    method: 'DELETE',
  }),

  // Generate price change simulation using stored procedure
  generatePriceChangeSimulation: (materialPriceChanges) => apiRequest('/hpp/generate-price-change-simulation', {
    method: 'POST',
    body: JSON.stringify({ materialPriceChanges }),
  }),

  // Get affected products for price change simulation
  getPriceChangeAffectedProducts: (description, simulasiDate) => apiRequest('/hpp/price-change-affected-products', {
    method: 'POST',
    body: JSON.stringify({ description, simulasiDate }),
  }),

  // Bulk delete price change group (all simulations with matching description and date)
  bulkDeletePriceChangeGroup: (description, simulasiDate) => apiRequest('/hpp/simulation/bulk-delete-price-change-group', {
    method: 'DELETE',
    body: JSON.stringify({ description, simulasiDate }),
  }),

  // Get simulation summary with HNA and HPP ratio data
  getSimulationSummary: (simulasiId) => apiRequest(`/hpp/simulation/${simulasiId}/summary`),
};

// Combined service for creating complete HPP records
export const hppService = {
  // Create complete HPP record (product + hpp + ingredients)
  createComplete: async (productData, hppData) => {
    try {
      // Step 1: Create or find product
      let product;
      try {
        // Try to create new product
        const productResponse = await productsAPI.create(productData);
        product = productResponse.data;
      } catch (error) {
        // If product creation fails (maybe duplicate), we could implement search logic here
        throw new Error(`Failed to create product: ${error.message}`);
      }

      // Step 2: Create HPP record with ingredients
      const hppPayload = {
        productId: product.id,
        biayaTenagaKerja: parseFloat(hppData.biayaTenagaKerja) || 0,
        biayaOverhead: parseFloat(hppData.biayaOverhead) || 0,
        ingredients: hppData.ingredients || [],
        notes: hppData.notes || '',
      };

      const hppResponse = await hppAPI.create(hppPayload);

      return {
        success: true,
        data: {
          product: product,
          hpp: hppResponse.data,
        },
        message: 'HPP record created successfully',
      };
    } catch (error) {
      console.error('Error creating complete HPP record:', error);
      throw error;
    }
  },

  // Search for existing products
  searchProducts: async (searchTerm) => {
    try {
      const response = await productsAPI.getAll({ search: searchTerm });
      return response.data.products;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },
};

// Master API (for currencies, materials, etc.)
export const masterAPI = {
  // Get currency data
  getCurrency: () => apiRequest('/master/currency'),
  
  // Get material/bahan data
  getBahan: () => apiRequest('/master/bahan'),
  
  // Get harga bahan data
  getHargaBahan: (periode = null) => {
    const url = periode ? `/master/hargaBahan?periode=${periode}` : '/master/hargaBahan';
    return apiRequest(url);
  },
  
  // Get unit data
  getUnit: () => apiRequest('/master/unit'),
  
  // Get manufacturing items data
  getManufacturingItems: () => apiRequest('/master/manufacturingItems'),
  
  // Add new harga bahan
  addHargaBahan: (data) => apiRequest('/master/hargaBahan', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Update harga bahan
  updateHargaBahan: (id, data) => apiRequest(`/master/hargaBahan/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete harga bahan
  deleteHargaBahan: (id) => apiRequest(`/master/hargaBahan/${id}`, {
    method: 'DELETE',
  }),
  
  // Bulk import bahan baku
  bulkImportBahanBaku: (items, periode = null) => apiRequest('/master/hargaBahan/bulk-import-bahan-baku', {
    method: 'POST',
    body: JSON.stringify({ items, periode }),
  }),
  
  // Bulk import bahan kemas
  bulkImportBahanKemas: (items, periode = null) => apiRequest('/master/hargaBahan/bulk-import-bahan-kemas', {
    method: 'POST',
    body: JSON.stringify({ items, periode }),
  }),
  
  // Get parameters
  getParameter: () => apiRequest('/master/parameter'),
  
  // Update parameters
  updateParameter: (data) => apiRequest('/master/parameter', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // General Costs per Sediaan API methods
  getGeneralCostsPerSediaan: () => apiRequest('/master/generalCostsPerSediaan'),
  
  addGeneralCostPerSediaan: (data) => apiRequest('/master/generalCostsPerSediaan', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  updateGeneralCostPerSediaan: (originalKeys, data) => apiRequest(`/master/generalCostsPerSediaan/${encodeURIComponent(originalKeys.periode)}/${encodeURIComponent(originalKeys.lineProduction)}/${encodeURIComponent(originalKeys.bentukSediaan)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteGeneralCostPerSediaan: (keys) => apiRequest(`/master/generalCostsPerSediaan/${encodeURIComponent(keys.periode)}/${encodeURIComponent(keys.lineProduction)}/${encodeURIComponent(keys.bentukSediaan)}`, {
    method: 'DELETE',
  }),  bulkImportGeneralCostsPerSediaan: (items) => apiRequest('/master/generalCostsPerSediaan/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }),
  
  // Get groups
  getGroup: (periode) => apiRequest(`/master/group?periode=${periode || new Date().getFullYear()}`),
  
  // Get group manual data
  getGroupManual: () => apiRequest('/master/groupManual'),
  
  // Add new group
  addGroup: (data) => apiRequest('/master/group', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Update group
  updateGroup: (id, data) => apiRequest(`/master/group/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete group
  deleteGroup: (id) => apiRequest(`/master/group/${id}`, {
    method: 'DELETE',
  }),
  
  // Bulk import Generik groups
  // Bulk import all product groups with year (periode)
  bulkImportProductGroup: (productData, periode, userId) => apiRequest('/master/group/bulk-import-all', {
    method: 'POST',
    body: JSON.stringify({ productData, periode, userId }),
  }),
  
  // Get product names
  getProductName: () => apiRequest('/master/productName'),
  
  // Get pembebanan data
  getPembebanan: () => apiRequest('/master/pembebanan'),
  
  // Add new pembebanan
  addPembebanan: (data) => apiRequest('/master/pembebanan', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Update pembebanan
  updatePembebanan: (id, data) => apiRequest(`/master/pembebanan/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete pembebanan
  deletePembebanan: (id) => apiRequest(`/master/pembebanan/${id}`, {
    method: 'DELETE',
  }),
  
  // Bulk import pembebanan
  bulkImportPembebanan: (pembebanانData, userId = 'system', periode = null) => apiRequest('/master/pembebanan/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ pembebanانData, userId, periode }),
  }),
  
  // Get material data
  getMaterial: () => apiRequest('/master/material'),
  
  // Get material usage data
  getMaterialUsage: () => apiRequest('/master/materialUsage'),
  
  // Get material usage data filtered by year
  getMaterialUsageByYear: (year) => apiRequest(`/master/materialUsage/${year}`),
  
  // === FORMULA MANUAL CUD OPERATIONS ===
  
  // Add new formula ingredient
  addFormulaManual: (data) => apiRequest('/master/formula', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Add complete formula with multiple ingredients
  addBatchFormulaManual: (data) => apiRequest('/master/formula/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Update formula ingredient
  updateFormulaManual: (data) => apiRequest('/master/formula', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete formula ingredient
  deleteFormulaManual: (data) => apiRequest('/master/formula', {
    method: 'DELETE',
    body: JSON.stringify(data),
  }),
  
  // Delete entire formula (all ingredients for a specific formula)
  deleteEntireFormulaManual: (data) => apiRequest('/master/formula/entire', {
    method: 'DELETE',
    body: JSON.stringify(data),
  }),
  
  // Export all formula detail using stored procedure
  exportAllFormulaDetail: () => apiRequest('/master/export-all-formula', {
    method: 'GET',
  }),
  
  // Export all formula detail sum per sub ID using stored procedure
  exportAllFormulaDetailSumPerSubID: () => apiRequest('/master/export-all-formula-sum-per-subid', {
    method: 'GET',
  }),
};

// Reagen API
export const reagenAPI = {
  // Get all reagen entries (with optional filters and product info)
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/reagen${queryString ? `?${queryString}` : ''}`);
  },

  // Get reagen entry by ID
  getById: (id) => apiRequest(`/reagen/${id}`),

  // Create new reagen entry
  create: (reagenData) => apiRequest('/reagen', {
    method: 'POST',
    body: JSON.stringify(reagenData),
  }),

  // Update reagen entry
  update: (id, reagenData) => apiRequest(`/reagen/${id}`, {
    method: 'PUT',
    body: JSON.stringify(reagenData),
  }),

  // Delete reagen entry
  delete: (id) => apiRequest(`/reagen/${id}`, {
    method: 'DELETE',
  }),

  // Bulk delete reagen entries
  bulkDelete: (ids) => apiRequest('/reagen/bulk/delete', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  }),

  // Bulk delete reagen entries by Periode
  bulkDeleteByPeriode: (periode) => apiRequest(`/reagen/bulk/delete/periode/${encodeURIComponent(periode)}`, {
    method: 'DELETE',
  }),

  // Bulk insert reagen entries (for import)
  bulkInsert: (entries, userId = null) => apiRequest('/reagen/bulk/insert', {
    method: 'POST',
    body: JSON.stringify({ entries, userId }),
  }),

  // Validate Product ID
  validateProductId: (productId) => apiRequest(`/reagen/validate/${productId}`),

  // Get reagen entries with product information
  getAllWithProductInfo: () => apiRequest('/reagen?withProductInfo=true'),
};

// TollFee API
export const tollFeeAPI = {
  // Get toll fee entries from view with category and period filtering
  getFromView: (kategori = null, periode = null) => {
    const params = new URLSearchParams();
    if (kategori) params.append('kategori', kategori);
    if (periode) params.append('periode', periode);
    return apiRequest(`/toll-fee/view${params.toString() ? `?${params.toString()}` : ''}`);
  },

  // Get ALL toll fee entries from view including those without margins (for export)
  getFromViewForExport: (kategori = null, periode = null) => {
    const params = new URLSearchParams();
    if (kategori) params.append('kategori', kategori);
    if (periode) params.append('periode', periode);
    return apiRequest(`/toll-fee/view/export${params.toString() ? `?${params.toString()}` : ''}`);
  },

  // Update toll fee entry by Product ID and Periode
  updateByProductAndPeriode: (productId, periode, tollFeeData) => apiRequest(
    `/toll-fee/product/${encodeURIComponent(productId)}/periode/${encodeURIComponent(periode)}`,
    {
      method: 'PUT',
      body: JSON.stringify(tollFeeData),
    }
  ),

  // Delete toll fee entry by Product ID and Periode
  deleteByProductAndPeriode: (productId, periode) => apiRequest(
    `/toll-fee/product/${encodeURIComponent(productId)}/periode/${encodeURIComponent(periode)}`,
    {
      method: 'DELETE',
    }
  ),

  // Get all toll fee entries (with optional filters and product info)
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/toll-fee${queryString ? `?${queryString}` : ''}`);
  },

  // Get toll fee entry by ID
  getById: (id) => apiRequest(`/toll-fee/${id}`),

  // Create new toll fee entry
  create: (tollFeeData) => apiRequest('/toll-fee', {
    method: 'POST',
    body: JSON.stringify(tollFeeData),
  }),

  // Update toll fee entry
  update: (id, tollFeeData) => apiRequest(`/toll-fee/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tollFeeData),
  }),

  // Delete toll fee entry
  delete: (id) => apiRequest(`/toll-fee/${id}`, {
    method: 'DELETE',
  }),

  // Bulk delete toll fee entries
  bulkDelete: (ids) => apiRequest('/toll-fee/bulk/delete', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  }),

  // Bulk delete toll fee entries by Periode
  bulkDeleteByPeriode: (periode) => apiRequest(`/toll-fee/bulk/delete/periode/${encodeURIComponent(periode)}`, {
    method: 'DELETE',
  }),

  // Bulk insert toll fee entries (for import)
  bulkInsert: (entries, userId = null) => apiRequest('/toll-fee/bulk/insert', {
    method: 'POST',
    body: JSON.stringify({ entries, userId }),
  }),

  // Validate Product ID
  validateProductId: (productId) => apiRequest(`/toll-fee/validate/${productId}`),

  // Get toll fee entries with product information
  getAllWithProductInfo: () => apiRequest('/toll-fee?withProductInfo=true'),

  // Get toll fee statistics (bonus endpoint for reporting)
  getStats: () => apiRequest('/toll-fee/stats'),
};

// Health check
export const healthAPI = {
  check: () => apiRequest('/health', { method: 'GET' }),
};

export default {
  products: productsAPI,
  hpp: hppAPI,
  hppService,
  master: masterAPI,
  reagen: reagenAPI,
  tollFee: tollFeeAPI,
  health: healthAPI,
};
