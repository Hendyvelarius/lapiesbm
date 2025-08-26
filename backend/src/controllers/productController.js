const { Product, HPP, HPPIngredient } = require('../../models');
const { Op } = require('sequelize');
const { getChosenFormula, getFormula, findFormula, addChosenFormula, updateChosenFormula, deleteChosenFormula, findRecipe } = require('../models/productModel');

class ProductController {
  // Get all products
  static async getAllProducts(req, res) {
    try {
      const { page = 1, limit = 10, search, jenisProduk, kategori } = req.query;
      const offset = (page - 1) * limit;
      
      // Build where clause for filtering
      const whereClause = {};
      
      if (search) {
        whereClause.namaProduk = {
          [Op.iLike]: `%${search}%`
        };
      }
      
      if (jenisProduk) {
        whereClause.jenisProduk = jenisProduk;
      }
      
      if (kategori) {
        whereClause.kategori = kategori;
      }

      const { count, rows } = await Product.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [{
          model: HPP,
          as: 'hppRecords',
          attributes: ['id', 'totalHPP', 'status', 'createdAt']
        }]
      });

      res.status(200).json({
        success: true,
        data: {
          products: rows,
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
        message: 'Error retrieving products',
        error: error.message
      });
    }
  }

  // Get product by ID
  static async getProductById(req, res) {
    try {
      const { id } = req.params;
      
      const product = await Product.findByPk(id, {
        include: [{
          model: HPP,
          as: 'hppRecords',
          include: [{
            model: HPPIngredient,
            as: 'ingredients'
          }]
        }]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving product',
        error: error.message
      });
    }
  }

  // Create new product
  static async createProduct(req, res) {
    try {
      const { namaProduk, harga, jenisProduk, bentuk, kategori, pabrik, expiry } = req.body;

      // Validate required fields
      if (!namaProduk || !harga || !jenisProduk) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: namaProduk, harga, jenisProduk'
        });
      }

      const product = await Product.create({
        namaProduk,
        harga,
        jenisProduk,
        bentuk,
        kategori,
        pabrik,
        expiry
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: error.message
      });
    }
  }

  // Update product
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { namaProduk, harga, jenisProduk, bentuk, kategori, pabrik, expiry } = req.body;

      const product = await Product.findByPk(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      await product.update({
        namaProduk,
        harga,
        jenisProduk,
        bentuk,
        kategori,
        pabrik,
        expiry
      });

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating product',
        error: error.message
      });
    }
  }

  // Delete product
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      
      const product = await Product.findByPk(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      await product.destroy();

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting product',
        error: error.message
      });
    }
  }

  static async getFormula(req, res) {
    try {
      const formulas = await getFormula();
      res.status(200).json(formulas);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formulas',
        error: error.message
      });
    }
  }

  static async findFormula(req, res) {
    try {
      const { id } = req.params;
      const formula = await findFormula(id);
      if (!formula) {
        return res.status(404).json('Formula not found');
      }
      res.status(200).json(formula);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formula',
        error: error.message
      });
    }
  }

  static async getChosenFormula(req, res) {
    try {
      const formulas = await getChosenFormula();
      res.status(200).json(formulas);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving chosen formulas',
        error: error.message
      });
    }
  }

  static async addChosenFormula(req, res) {
    try {
      const { productId, pi, ps, kp, ks, stdOutput } = req.body;
      
      // Validate required field
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const result = await addChosenFormula(
        productId,
        pi,
        ps,
        kp,
        ks,
        stdOutput,
        'SYSTEM' // Default user
      );

      res.status(201).json({
        success: true,
        message: 'Chosen formula created successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating chosen formula',
        error: error.message
      });
    }
  }

  static async updateChosenFormula(req, res) {
    try {
      const { productId } = req.params;
      const { pi, ps, kp, ks, stdOutput } = req.body;

      const result = await updateChosenFormula(
        productId,
        pi,
        ps,
        kp,
        ks,
        stdOutput,
        'SYSTEM' // Default user
      );

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chosen formula not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Chosen formula updated successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating chosen formula',
        error: error.message
      });
    }
  }

  static async deleteChosenFormula(req, res) {
    try {
      const { productId } = req.params;

      const result = await deleteChosenFormula(productId);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chosen formula not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Chosen formula deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting chosen formula',
        error: error.message
      });
    }
  }
  
  static async findRecipe(req, res) {
    try {
      const { productId } = req.params;
      const recipe = await findRecipe(productId);
      if (!recipe) {
        return res.status(404).json('Recipe not found');
      }
      res.status(200).json(recipe);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving recipe',
        error: error.message
      });
    }
  }
}

module.exports = ProductController;
