const { HPP, Product, HPPIngredient } = require('../../models');

class HPPService {
  /**
   * Calculate total HPP based on ingredients, labor, and overhead costs
   */
  static calculateTotalHPP(ingredients, biayaTenagaKerja, biayaOverhead) {
    const totalBahanBaku = ingredients.reduce((sum, ingredient) => {
      return sum + (parseFloat(ingredient.jumlah) * parseFloat(ingredient.hargaSatuan));
    }, 0);

    return {
      totalBahanBaku,
      totalHPP: parseFloat(biayaTenagaKerja) + parseFloat(biayaOverhead) + totalBahanBaku
    };
  }

  /**
   * Validate HPP creation data
   */
  static validateHPPData(data) {
    const { productId, biayaTenagaKerja, biayaOverhead, ingredients } = data;
    const errors = [];

    if (!productId) errors.push('Product ID is required');
    if (!biayaTenagaKerja || isNaN(biayaTenagaKerja)) errors.push('Valid labor cost is required');
    if (!biayaOverhead || isNaN(biayaOverhead)) errors.push('Valid overhead cost is required');

    if (ingredients && ingredients.length > 0) {
      ingredients.forEach((ingredient, index) => {
        if (!ingredient.namaBahan) errors.push(`Ingredient ${index + 1}: Name is required`);
        if (!ingredient.jumlah || isNaN(ingredient.jumlah)) errors.push(`Ingredient ${index + 1}: Valid quantity is required`);
        if (!ingredient.satuan) errors.push(`Ingredient ${index + 1}: Unit is required`);
        if (!ingredient.hargaSatuan || isNaN(ingredient.hargaSatuan)) errors.push(`Ingredient ${index + 1}: Valid unit price is required`);
      });
    }

    return errors;
  }

  /**
   * Get HPP summary for a product
   */
  static async getProductHPPSummary(productId) {
    const hppRecords = await HPP.findAll({
      where: { productId },
      attributes: ['id', 'totalHPP', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const confirmedRecords = hppRecords.filter(hpp => hpp.status === 'confirmed');
    const latestHPP = confirmedRecords.length > 0 ? confirmedRecords[0] : null;

    return {
      totalRecords: hppRecords.length,
      confirmedRecords: confirmedRecords.length,
      latestHPP,
      averageHPP: confirmedRecords.length > 0 
        ? confirmedRecords.reduce((sum, hpp) => sum + parseFloat(hpp.totalHPP), 0) / confirmedRecords.length 
        : 0
    };
  }

  /**
   * Compare HPP records
   */
  static async compareHPPRecords(hppIds) {
    const hppRecords = await HPP.findAll({
      where: {
        id: hppIds
      },
      include: [
        { model: Product, as: 'product' },
        { model: HPPIngredient, as: 'ingredients' }
      ]
    });

    return hppRecords.map(hpp => ({
      id: hpp.id,
      product: hpp.product.namaProduk,
      totalHPP: hpp.totalHPP,
      breakdown: {
        bahan_baku: hpp.totalBahanBaku,
        tenaga_kerja: hpp.biayaTenagaKerja,
        overhead: hpp.biayaOverhead
      },
      ingredients_count: hpp.ingredients.length,
      status: hpp.status,
      created_at: hpp.createdAt
    }));
  }
}

module.exports = HPPService;
