'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('hpp_ingredients', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      hppId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'hpp',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      namaBahan: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      jumlah: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false
      },
      satuan: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      hargaSatuan: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      totalHarga: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      supplier: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      tanggalPembelian: {
        type: Sequelize.DATE,
        allowNull: true
      },
      nomorBatch: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      kadaluarsa: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('hpp_ingredients');
  }
};
