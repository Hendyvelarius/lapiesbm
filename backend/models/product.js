'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      // Satu produk punya banyak HPP (dalam konteks ini mungkin ada versi HPP baru dan HPP lama tetap tersimpan)
      Product.hasMany(models.HPP, {
        foreignKey: 'productId',
        as: 'hppRecords'
      });
    }
  }
  
  Product.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    namaProduk: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    harga: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    jenisProduk: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    bentuk: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kategori: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pabrik: {
      type: DataTypes.STRING,
      allowNull: true
    },
    expiry: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products'
  });
  
  return Product;
};
