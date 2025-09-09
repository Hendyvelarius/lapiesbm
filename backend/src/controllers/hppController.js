const { HPP, Product, HPPIngredient } = require('../../models');
const { Op } = require('sequelize');
const { getHPP, generateHPPCalculation } = require('../models/hppModel');

class HPPController {
  // Get all HPP records
  static async getHPP(req, res) {
    try {
      const hpp = await getHPP();
      res.status(200).json(hpp);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP data',
        error: error.message
      });
    }
  }

  static async getAllHPP(req, res) {
    try {
      const { page = 1, limit = 10, productId, status } = req.query;
      const offset = (page - 1) * limit;
      
      // Build where clause for filtering
      const whereClause = {};
      
      if (productId) {
        whereClause.productId = productId;
      }
      
      if (status) {
        whereClause.status = status;
      }

      const { count, rows } = await HPP.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'namaProduk', 'jenisProduk', 'kategori']
          },
          {
            model: HPPIngredient,
            as: 'ingredients'
          }
        ]
      });

      res.status(200).json({
        success: true,
        data: {
          hppRecords: rows,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP records',
        error: error.message
      });
    }
  }

  // Get HPP by ID
  static async getHPPById(req, res) {
    try {
      const { id } = req.params;
      
      const hpp = await HPP.findByPk(id, {
        include: [
          {
            model: Product,
            as: 'product'
          },
          {
            model: HPPIngredient,
            as: 'ingredients'
          }
        ]
      });

      if (!hpp) {
        return res.status(404).json({
          success: false,
          message: 'HPP record not found'
        });
      }

      res.status(200).json({
        success: true,
        data: hpp
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP record',
        error: error.message
      });
    }
  }

  // Create new HPP with ingredients
  static async createHPP(req, res) {
    const transaction = await HPP.sequelize.transaction();
    
    try {
      const {
        productId,
        biayaTenagaKerja,
        biayaOverhead,
        ingredients,
        notes
      } = req.body;

      // Validate required fields
      if (!productId || !biayaTenagaKerja || !biayaOverhead) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Required fields: productId, biayaTenagaKerja, biayaOverhead'
        });
      }

      // Validate product exists
      const product = await Product.findByPk(productId);
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Calculate total bahan baku
      let totalBahanBaku = 0;
      if (ingredients && ingredients.length > 0) {
        totalBahanBaku = ingredients.reduce((sum, ingredient) => {
          return sum + (parseFloat(ingredient.jumlah) * parseFloat(ingredient.hargaSatuan));
        }, 0);
      }

      // Calculate total HPP
      const totalHPP = parseFloat(biayaTenagaKerja) + parseFloat(biayaOverhead) + totalBahanBaku;

      // Create HPP record
      const hpp = await HPP.create({
        productId,
        biayaTenagaKerja,
        biayaOverhead,
        totalBahanBaku,
        totalHPP,
        status: 'draft',
        notes
      }, { transaction });

      // Create ingredients if provided
      if (ingredients && ingredients.length > 0) {
        const ingredientData = ingredients.map(ingredient => ({
          hppId: hpp.id,
          namaBahan: ingredient.namaBahan,
          jumlah: ingredient.jumlah,
          satuan: ingredient.satuan,
          hargaSatuan: ingredient.hargaSatuan,
          totalHarga: parseFloat(ingredient.jumlah) * parseFloat(ingredient.hargaSatuan),
          supplier: ingredient.supplier,
          tanggalPembelian: ingredient.tanggalPembelian,
          nomorBatch: ingredient.nomorBatch,
          kadaluarsa: ingredient.kadaluarsa,
          notes: ingredient.notes
        }));

        await HPPIngredient.bulkCreate(ingredientData, { transaction });
      }

      await transaction.commit();

      // Fetch the complete record
      const completeHPP = await HPP.findByPk(hpp.id, {
        include: [
          { model: Product, as: 'product' },
          { model: HPPIngredient, as: 'ingredients' }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'HPP created successfully',
        data: completeHPP
      });
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({
        success: false,
        message: 'Error creating HPP',
        error: error.message
      });
    }
  }

  // Update HPP status (confirm/archive)
  static async updateHPPStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, confirmedBy } = req.body;

      const hpp = await HPP.findByPk(id);
      
      if (!hpp) {
        return res.status(404).json({
          success: false,
          message: 'HPP record not found'
        });
      }

      const updateData = { status };
      
      if (status === 'confirmed') {
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = confirmedBy;
      }

      await hpp.update(updateData);

      res.status(200).json({
        success: true,
        message: 'HPP status updated successfully',
        data: hpp
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating HPP status',
        error: error.message
      });
    }
  }

  // Delete HPP (only if status is draft)
  static async deleteHPP(req, res) {
    try {
      const { id } = req.params;
      
      const hpp = await HPP.findByPk(id);
      
      if (!hpp) {
        return res.status(404).json({
          success: false,
          message: 'HPP record not found'
        });
      }

      if (hpp.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Can only delete HPP records with draft status'
        });
      }

      await hpp.destroy();

      res.status(200).json({
        success: true,
        message: 'HPP record deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting HPP record',
        error: error.message
      });
    }
  }

  // Generate HPP calculation using stored procedure
  static async generateHPPCalculation(req, res) {
    try {
      const { periode } = req.body;
      
      // Default periode to current year if not provided
      const calculationPeriode = periode || new Date().getFullYear().toString();
      
      // Validate period format
      if (!/^\d{4}$/.test(calculationPeriode)) {
        return res.status(400).json({
          success: false,
          message: 'Period must be a 4-digit year (e.g., 2025)'
        });
      }
      
      const result = await generateHPPCalculation(calculationPeriode);
      
      res.status(200).json({
        success: true,
        message: `HPP calculation completed successfully for period ${calculationPeriode}`,
        data: {
          periode: calculationPeriode,
          processedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error generating HPP calculation',
        error: error.message
      });
    }
  }
}

module.exports = HPPController;
