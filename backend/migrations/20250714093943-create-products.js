'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      namaProduk: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      harga: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      jenisProduk: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bentuk: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      kategori: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      pabrik: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      expiry: {
        type: Sequelize.DATEONLY,
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
    await queryInterface.dropTable('products');
  }
};