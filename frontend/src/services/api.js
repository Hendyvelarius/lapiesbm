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
  getChosenFormula: () => apiRequest('/products/chosenformula'),
  
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
  deleteChosenFormula: (productId) => apiRequest(`/products/chosenformula/${productId}`, {
    method: 'DELETE',
  }),
  
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
};

// HPP API
export const hppAPI = {
  // Get HPP calculation results (three tables: ethical, generik1, generik2)
  getResults: () => apiRequest('/hpp/data'),

  // Generate HPP calculation
  generateCalculation: (periode) => apiRequest('/hpp/generate', {
    method: 'POST',
    body: JSON.stringify({ periode }),
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
  getHargaBahan: () => apiRequest('/master/hargaBahan'),
  
  // Get unit data
  getUnit: () => apiRequest('/master/unit'),
  
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
  
  // Get parameters
  getParameter: () => apiRequest('/master/parameter'),
  
  // Update parameters
  updateParameter: (data) => apiRequest('/master/parameter', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Get groups
  getGroup: () => apiRequest('/master/group'),
  
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
  
  // Get material data
  getMaterial: () => apiRequest('/master/material'),
  
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
  health: healthAPI,
};
