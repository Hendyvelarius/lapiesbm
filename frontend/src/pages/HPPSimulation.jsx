import React, { useState } from 'react';
import { hppService } from '../services/api';
import '../styles/HPPSimulation.css';

const initialProduct = {
  namaProduk: '',
  harga: '',
  jenisProduk: '',
  bentuk: '',
  kategori: '',
  pabrik: '',
  expiry: '',
};

const initialHPP = {
  ingredients: [{ name: '', qty: '', price: '' }],
  labor: '',
  overhead: '',
};

export default function HPPSimulation() {
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState(initialProduct);
  const [hpp, setHPP] = useState(initialHPP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Handlers for form changes
  const handleProductChange = e => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };
  const handleHPPChange = (idx, field, value) => {
    const newIngredients = hpp.ingredients.map((ing, i) =>
      i === idx ? { ...ing, [field]: value } : ing
    );
    setHPP({ ...hpp, ingredients: newIngredients });
  };
  const addIngredient = () => {
    setHPP({ ...hpp, ingredients: [...hpp.ingredients, { name: '', qty: '', price: '' }] });
  };

  const removeIngredient = (idx) => {
    if (hpp.ingredients.length > 1) {
      const newIngredients = hpp.ingredients.filter((_, i) => i !== idx);
      setHPP({ ...hpp, ingredients: newIngredients });
    }
  };
  const handleHPPField = e => {
    setHPP({ ...hpp, [e.target.name]: e.target.value });
  };

  // Submit function to create complete HPP record
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Prepare product data
      const productData = {
        namaProduk: product.namaProduk,
        harga: parseFloat(product.harga),
        jenisProduk: product.jenisProduk,
        bentuk: product.bentuk || null,
        kategori: product.kategori || null,
        pabrik: product.pabrik || null,
        expiry: product.expiry || null,
      };

      // Prepare HPP data with ingredients
      const hppData = {
        biayaTenagaKerja: parseFloat(hpp.labor) || 0,
        biayaOverhead: parseFloat(hpp.overhead) || 0,
        ingredients: hpp.ingredients
          .filter(ing => ing.name && ing.qty && ing.price) // Only include complete ingredients
          .map(ing => ({
            namaBahan: ing.name,
            jumlah: parseFloat(ing.qty),
            satuan: 'gr', // Default unit, you can make this configurable
            hargaSatuan: parseFloat(ing.price),
            supplier: null, // Can be added to form later
            tanggalPembelian: null,
            nomorBatch: null,
            kadaluarsa: null,
            notes: null,
          })),
        notes: `HPP created for ${product.namaProduk}`,
      };

      // Create complete HPP record
      const result = await hppService.createComplete(productData, hppData);
      
      console.log('HPP created successfully:', result);
      setSuccess(true);
      
      // Reset form after success
      setTimeout(() => {
        setProduct(initialProduct);
        setHPP(initialHPP);
        setStep(1);
        setSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Error creating HPP:', error);
      setError(error.message || 'Failed to create HPP record');
    } finally {
      setLoading(false);
    }
  };

  // Stepper
  const steps = ['Informasi Produk', 'HPP Produk', 'Review'];

  // Validation functions
  const validateStep1 = () => {
    return product.namaProduk && product.harga && product.jenisProduk;
  };

  const validateStep2 = () => {
    const hasValidIngredients = hpp.ingredients.some(ing => ing.name && ing.qty && ing.price);
    const hasLaborOrOverhead = hpp.labor || hpp.overhead;
    return hasValidIngredients || hasLaborOrOverhead;
  };

  const handleNextStep = (nextStep) => {
    setError(''); // Clear any existing errors
    
    if (nextStep === 2 && !validateStep1()) {
      setError('Please fill in all required product information (Name, Price, Type)');
      return;
    }
    
    if (nextStep === 3 && !validateStep2()) {
      setError('Please add at least one ingredient or labor/overhead cost');
      return;
    }
    
    setStep(nextStep);
  };

  return (
    <div className="hpp-simulation-container">
      <div className="stepper">
        {steps.map((label, i) => (
          <div key={label} className={`step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
            <div className="circle">{i + 1}</div>
            <div className="label">{label}</div>
            {i < steps.length - 1 && <div className="bar" />}
          </div>
        ))}
      </div>
      <div className="hpp-simulation-card">
        {error && step !== 3 && (
          <div className="error-message" style={{
            background: '#fee',
            border: '1px solid #fcc',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#c00'
          }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={e => { e.preventDefault(); handleNextStep(2); }}>
            <h2>Informasi Produk</h2>
            <div className="form-content">
              <div className="form-row">
                <label>Nama Produk</label>
                <input name="namaProduk" value={product.namaProduk} onChange={handleProductChange} required />
              </div>
              <div className="form-row">
                <label>Harga</label>
                <input name="harga" value={product.harga} onChange={handleProductChange} required type="number" min="0" />
              </div>
              <div className="form-row">
                <label>Jenis Produk</label>
                <input name="jenisProduk" value={product.jenisProduk} onChange={handleProductChange} required />
              </div>
              <div className="form-row">
                <label>Bentuk</label>
                <input name="bentuk" value={product.bentuk} onChange={handleProductChange} />
              </div>
              <div className="form-row">
                <label>Kategori</label>
                <input name="kategori" value={product.kategori} onChange={handleProductChange} />
              </div>
              <div className="form-row">
                <label>Pabrik</label>
                <input name="pabrik" value={product.pabrik} onChange={handleProductChange} />
              </div>
              <div className="form-row">
                <label>Expiry Date</label>
                <input name="expiry" value={product.expiry} onChange={handleProductChange} type="date" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" disabled>Back</button>
              <button type="submit">Next Step</button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); handleNextStep(3); }}>
            <h2>HPP Produk</h2>
            <div className="form-content single-column">
              <div className="form-row">
                <label>Bahan Baku</label>
                <div>
                  {hpp.ingredients.map((ing, idx) => (
                    <div className="ingredient-row" key={idx}>
                      <input 
                        placeholder="Nama Bahan" 
                        value={ing.name} 
                        onChange={e => handleHPPChange(idx, 'name', e.target.value)} 
                      />
                      <input 
                        placeholder="Jumlah (gr)" 
                        value={ing.qty} 
                        onChange={e => handleHPPChange(idx, 'qty', e.target.value)} 
                        type="number" 
                        min="0" 
                        step="0.01"
                      />
                      <input 
                        placeholder="Harga Satuan" 
                        value={ing.price} 
                        onChange={e => handleHPPChange(idx, 'price', e.target.value)} 
                        type="number" 
                        min="0" 
                        step="0.01"
                      />
                      {hpp.ingredients.length > 1 && (
                        <button 
                          type="button" 
                          className="remove-btn" 
                          onClick={() => removeIngredient(idx)}
                          style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="add-btn" onClick={addIngredient}>+ Tambah Bahan</button>
                </div>
              </div>
              <div className="form-row">
                <label>Biaya Tenaga Kerja</label>
                <input 
                  name="labor" 
                  value={hpp.labor} 
                  onChange={handleHPPField} 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div className="form-row">
                <label>Biaya Overhead</label>
                <input 
                  name="overhead" 
                  value={hpp.overhead} 
                  onChange={handleHPPField} 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setStep(1)}>Back</button>
              <button type="submit">Next Step</button>
            </div>
          </form>
        )}
        {step === 3 && (
          <div>
            <h2>Review</h2>
            
            {error && (
              <div className="error-message" style={{
                background: '#fee',
                border: '1px solid #fcc',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '20px',
                color: '#c00'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{
                background: '#efe',
                border: '1px solid #cfc',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '20px',
                color: '#060'
              }}>
                HPP record created successfully! Redirecting...
              </div>
            )}

            <div className="review-section">
              <h3>Informasi Produk</h3>
              <ul>
                <li><b>Nama Produk:</b> {product.namaProduk}</li>
                <li><b>Harga:</b> Rp {parseFloat(product.harga || 0).toLocaleString('id-ID')}</li>
                <li><b>Jenis Produk:</b> {product.jenisProduk}</li>
                <li><b>Bentuk:</b> {product.bentuk || '-'}</li>
                <li><b>Kategori:</b> {product.kategori || '-'}</li>
                <li><b>Pabrik:</b> {product.pabrik || '-'}</li>
                <li><b>Expiry Date:</b> {product.expiry || '-'}</li>
              </ul>
              
              <h3>HPP Produk</h3>
              <ul>
                {hpp.ingredients
                  .filter(ing => ing.name && ing.qty && ing.price)
                  .map((ing, idx) => (
                    <li key={idx}>
                      <b>{ing.name}</b>: {ing.qty} gr × Rp {parseFloat(ing.price || 0).toLocaleString('id-ID')} = 
                      Rp {(parseFloat(ing.qty || 0) * parseFloat(ing.price || 0)).toLocaleString('id-ID')}
                    </li>
                  ))}
                <li><b>Biaya Tenaga Kerja:</b> Rp {parseFloat(hpp.labor || 0).toLocaleString('id-ID')}</li>
                <li><b>Biaya Overhead:</b> Rp {parseFloat(hpp.overhead || 0).toLocaleString('id-ID')}</li>
                <li style={{ borderTop: '1px solid #ddd', paddingTop: '10px', marginTop: '10px', fontWeight: 'bold' }}>
                  <b>Total HPP:</b> Rp {(
                    hpp.ingredients
                      .filter(ing => ing.name && ing.qty && ing.price)
                      .reduce((sum, ing) => sum + (parseFloat(ing.qty || 0) * parseFloat(ing.price || 0)), 0) +
                    parseFloat(hpp.labor || 0) +
                    parseFloat(hpp.overhead || 0)
                  ).toLocaleString('id-ID')}
                </li>
              </ul>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => setStep(2)} 
                disabled={loading || success}
              >
                Back
              </button>
              <button 
                type="button" 
                className="confirm-btn" 
                onClick={handleSubmit}
                disabled={loading || success}
              >
                {loading ? 'Creating...' : 'Confirm & Create HPP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
