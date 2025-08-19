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
};

// HPP API
export const hppAPI = {
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
