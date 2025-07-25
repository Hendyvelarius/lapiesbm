import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sample data - replace with actual API calls later
  const dashboardData = {
    totalProducts: 45,
    totalCategories: 8,
    missingBatchSize: [
      { name: 'Vitamin C 500mg', category: 'Vitamin' },
      { name: 'Paracetamol 500mg', category: 'Analgesik' },
      { name: 'Amoxicillin 250mg', category: 'Antibiotik' },
      { name: 'Omeprazole 20mg', category: 'Antasida' },
      { name: 'Metformin 500mg', category: 'Antidiabetes' },
      { name: 'Aspirin 100mg', category: 'Antiplatelet' },
      { name: 'Simvastatin 20mg', category: 'Statin' },
      { name: 'Losartan 50mg', category: 'ARB' }
    ],
    missingFormula: [
      { name: 'Ibuprofen 400mg', category: 'Anti Inflamasi' },
      { name: 'Cetirizine 10mg', category: 'Antihistamin' },
      { name: 'Ranitidine 150mg', category: 'H2 Blocker' },
      { name: 'Diclofenac 50mg', category: 'NSAID' },
      { name: 'Loratadine 10mg', category: 'Antihistamin' },
      { name: 'Captopril 25mg', category: 'ACE Inhibitor' }
    ],
    notes: [
      { id: 1, title: 'Monthly HPP Review Meeting', date: '2025-07-20' },
      { id: 2, title: 'New Supplier Evaluation', date: '2025-07-18' },
      { id: 3, title: 'Cost Analysis Update', date: '2025-07-15' },
      { id: 4, title: 'Batch Size Optimization', date: '2025-07-12' }
    ]
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="dashboard-container">
      {/* Quick Info Cards */}
      <div className="dashboard-grid">
        {/* Summary Cards */}
        <div className="info-card" style={{gridArea: 'products'}}>
          <div className="card-icon products-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <div className="card-content">
            <h3>Jumlah Produk</h3>
            <p className="card-number">{dashboardData.totalProducts}</p>
            <span className="card-subtitle">Total produk terdaftar</span>
          </div>
        </div>

        <div className="info-card" style={{gridArea: 'categories'}}>
          <div className="card-icon categories-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h7v7H3z"/>
              <path d="M14 3h7v7h-7z"/>
              <path d="M14 14h7v7h-7z"/>
              <path d="M3 14h7v7H3z"/>
            </svg>
          </div>
          <div className="card-content">
            <h3>Jumlah Kategori</h3>
            <p className="card-number">{dashboardData.totalCategories}</p>
            <span className="card-subtitle">Kategori produk aktif</span>
          </div>
        </div>

        {/* Notes Card */}
        <div className="info-card notes-card" style={{gridArea: 'clock'}}>
          <div className="notes-header">
            <h3>Notes</h3>
            <button className="add-note-btn" title="Add new note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <div className="notes-list">
            {dashboardData.notes.map((note) => (
              <div key={note.id} className="note-item" onClick={() => console.log('Open note:', note.title)}>
                <span className="note-title">{note.title}</span>
                <span className="note-date">{new Date(note.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Shortcut Buttons */}
        <div className="shortcut-card" style={{gridArea: 'actions'}}>
          <h3>Quick Actions</h3>
          <div className="shortcut-buttons">
            <button className="shortcut-btn daftar-hpp" onClick={() => navigate('/')}>
              <div className="btn-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              </div>
              <span>Daftar HPP</span>
            </button>
            <button className="shortcut-btn simulasi-hpp" onClick={() => navigate('/hpp-simulation')}>
              <div className="btn-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10"/>
                  <path d="M12 20V4"/>
                  <path d="M6 20v-6"/>
                </svg>
              </div>
              <span>Simulasi HPP</span>
            </button>
          </div>
        </div>

        {/* Missing Batch Size */}
        <div className="warning-card batch-size-card tall-card" style={{gridArea: 'batch-size'}}>
          <div className="card-header">
            <div className="warning-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3>Batch Size Belum Terisi</h3>
            <span className="count-badge">{dashboardData.missingBatchSize.length}</span>
          </div>
          <div className="warning-list">
            {dashboardData.missingBatchSize.map((product, index) => (
              <div key={index} className="warning-item">
                <span className="product-name">{product.name}</span>
                <span className="product-category">{product.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Formula */}
        <div className="warning-card formula-card tall-card" style={{gridArea: 'formula'}}>
          <div className="card-header">
            <div className="warning-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3>Obat Tanpa Formula</h3>
            <span className="count-badge">{dashboardData.missingFormula.length}</span>
          </div>
          <div className="warning-list">
            {dashboardData.missingFormula.map((product, index) => (
              <div key={index} className="warning-item">
                <span className="product-name">{product.name}</span>
                <span className="product-category">{product.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
