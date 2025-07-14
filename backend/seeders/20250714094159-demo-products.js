'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('products', [
      {
        namaProduk: 'Vitamin C 1000mg',
        harga: 150000.00,
        jenisProduk: 'Suplemen',
        bentuk: 'Tablet',
        kategori: 'Vitamin',
        pabrik: 'PT LAPI Laboratories',
        expiry: '2025-12-31',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        namaProduk: 'Paracetamol 500mg',
        harga: 25000.00,
        jenisProduk: 'Obat',
        bentuk: 'Tablet',
        kategori: 'Analgesik',
        pabrik: 'PT LAPI Laboratories',
        expiry: '2026-06-30',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        namaProduk: 'Multivitamin Complex',
        harga: 200000.00,
        jenisProduk: 'Suplemen',
        bentuk: 'Kapsul',
        kategori: 'Vitamin',
        pabrik: 'PT LAPI Laboratories',
        expiry: '2025-09-15',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        namaProduk: 'Omega 3 Fish Oil',
        harga: 350000.00,
        jenisProduk: 'Suplemen',
        bentuk: 'Softgel',
        kategori: 'Minyak Ikan',
        pabrik: 'PT LAPI Laboratories',
        expiry: '2026-03-20',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        namaProduk: 'Probiotik Capsule',
        harga: 180000.00,
        jenisProduk: 'Suplemen',
        bentuk: 'Kapsul',
        kategori: 'Probiotik',
        pabrik: 'PT LAPI Laboratories',
        expiry: '2025-11-10',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('products', null, {});
  }
};
