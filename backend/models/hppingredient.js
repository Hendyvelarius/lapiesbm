'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class HPPIngredient extends Model {
    static associate(models) {
      // HPPIngredient belongs to HPP
      HPPIngredient.belongsTo(models.HPP, {
        foreignKey: 'hppId',
        as: 'hpp'
      });
    }
  }
  
  HPPIngredient.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    hppId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'hpp',
        key: 'id'
      }
    },
    namaBahan: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    jumlah: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true
      }
    },
    satuan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50]
      }
    },
    hargaSatuan: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true
      }
    },
    totalHarga: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true
      }
    },
    supplier: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tanggalPembelian: {
      type: DataTypes.DATE,
      allowNull: true
    },
    nomorBatch: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    kadaluarsa: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
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
    modelName: 'HPPIngredient',
    tableName: 'hpp_ingredients'
  });
  
  return HPPIngredient;
};
