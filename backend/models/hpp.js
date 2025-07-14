'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class HPP extends Model {
    static associate(models) {
      // HPP belongs to a product
      HPP.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });
      
      // HPP has many ingredients
      HPP.hasMany(models.HPPIngredient, {
        foreignKey: 'hppId',
        as: 'ingredients'
      });
    }
  }
  
  HPP.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    biayaTenagaKerja: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    biayaOverhead: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    totalBahanBaku: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    totalHPP: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.ENUM('draft', 'confirmed', 'archived'),
      allowNull: false,
      defaultValue: 'draft'
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    confirmedBy: {
      type: DataTypes.STRING,
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
    modelName: 'HPP',
    tableName: 'hpp'
  });
  
  return HPP;
};
