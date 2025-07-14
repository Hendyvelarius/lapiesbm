import React, { useState } from 'react';
import './InputHPP.css';

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

export default function InputHPP() {
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState(initialProduct);
  const [hpp, setHPP] = useState(initialHPP);

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
  const handleHPPField = e => {
    setHPP({ ...hpp, [e.target.name]: e.target.value });
  };

  // Stepper
  const steps = ['Informasi Produk', 'HPP Produk', 'Review'];

  return (
    <div className="input-hpp-container">
      <div className="stepper">
        {steps.map((label, i) => (
          <div key={label} className={`step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
            <div className="circle">{i + 1}</div>
            <div className="label">{label}</div>
            {i < steps.length - 1 && <div className="bar" />}
          </div>
        ))}
      </div>
      <div className="input-hpp-card">
        {step === 1 && (
          <form onSubmit={e => { e.preventDefault(); setStep(2); }}>
            <h2>Informasi Produk</h2>
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
            <div className="form-actions">
              <button type="button" disabled>Back</button>
              <button type="submit">Next Step</button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); setStep(3); }}>
            <h2>HPP Produk</h2>
            <div className="form-row">
              <label>Bahan Baku</label>
              {hpp.ingredients.map((ing, idx) => (
                <div className="ingredient-row" key={idx}>
                  <input placeholder="Nama Bahan" value={ing.name} onChange={e => handleHPPChange(idx, 'name', e.target.value)} />
                  <input placeholder="Jumlah (gr)" value={ing.qty} onChange={e => handleHPPChange(idx, 'qty', e.target.value)} type="number" min="0" />
                  <input placeholder="Harga Satuan" value={ing.price} onChange={e => handleHPPChange(idx, 'price', e.target.value)} type="number" min="0" />
                </div>
              ))}
              <button type="button" className="add-btn" onClick={addIngredient}>+ Tambah Bahan</button>
            </div>
            <div className="form-row">
              <label>Biaya Tenaga Kerja</label>
              <input name="labor" value={hpp.labor} onChange={handleHPPField} type="number" min="0" />
            </div>
            <div className="form-row">
              <label>Biaya Overhead</label>
              <input name="overhead" value={hpp.overhead} onChange={handleHPPField} type="number" min="0" />
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
            <div className="review-section">
              <h3>Informasi Produk</h3>
              <ul>
                <li><b>Nama Produk:</b> {product.namaProduk}</li>
                <li><b>Harga:</b> {product.harga}</li>
                <li><b>Jenis Produk:</b> {product.jenisProduk}</li>
                <li><b>Bentuk:</b> {product.bentuk}</li>
                <li><b>Kategori:</b> {product.kategori}</li>
                <li><b>Pabrik:</b> {product.pabrik}</li>
                <li><b>Expiry Date:</b> {product.expiry}</li>
              </ul>
              <h3>HPP Produk</h3>
              <ul>
                {hpp.ingredients.map((ing, idx) => (
                  <li key={idx}><b>{ing.name}</b>: {ing.qty} gr x Rp{ing.price}</li>
                ))}
                <li><b>Biaya Tenaga Kerja:</b> Rp{hpp.labor}</li>
                <li><b>Biaya Overhead:</b> Rp{hpp.overhead}</li>
              </ul>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setStep(1)}>Edit</button>
              <button type="button" className="confirm-btn">Confirm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
