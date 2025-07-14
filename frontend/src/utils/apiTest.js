// Test API connection
import api from '../services/api.js';

export const testAPIConnection = async () => {
  try {
    console.log('Testing API connection...');
    
    // Test health check
    const health = await api.health.check();
    console.log('✅ Health check:', health);
    
    // Test products API
    const products = await api.products.getAll();
    console.log('✅ Products API:', products);
    
    return { success: true, message: 'API connection successful' };
  } catch (error) {
    console.error('❌ API connection failed:', error);
    return { success: false, error: error.message };
  }
};

// Test creating a sample HPP
export const testCreateHPP = async () => {
  try {
    const sampleProduct = {
      namaProduk: 'Test Product API',
      harga: 100000,
      jenisProduk: 'Test',
      bentuk: 'Tablet',
      kategori: 'Test Category',
      pabrik: 'Test Factory',
      expiry: '2025-12-31'
    };

    const sampleHPP = {
      biayaTenagaKerja: 50000,
      biayaOverhead: 30000,
      ingredients: [
        {
          namaBahan: 'Test Ingredient',
          jumlah: 100,
          satuan: 'gr',
          hargaSatuan: 1000,
        }
      ]
    };

    const result = await api.hppService.createComplete(sampleProduct, sampleHPP);
    console.log('✅ Test HPP creation:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Test HPP creation failed:', error);
    throw error;
  }
};

export default {
  testAPIConnection,
  testCreateHPP
};
