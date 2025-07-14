const { Product, HPP, HPPIngredient } = require('../../models');
const { Op } = require('sequelize');

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
}

module.exports = ProductController;
