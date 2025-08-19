import { useState, useEffect } from 'react';
import { Edit, Save, X } from 'lucide-react';
import { masterAPI } from '../services/api';
import '../styles/BiayaLain.css';

export default function BiayaLain() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    directLabour: '0',
    foh: '0',
    depresiasi: '0',
    mhTimbangBB: '0',
    mhTimbangBK: '0',
    mhAnalisa: '0',
    biayaAnalisa: '0',
    kwhMesin: '0',
    rateKwhMesin: '0'
  });

  const [originalData, setOriginalData] = useState({});

  // Mock data for initial load
  useEffect(() => {
    loadBiayaLain();
  }, []);

  const loadBiayaLain = async () => {
    setLoading(true);
    try {
      const response = await masterAPI.getParameter();
      
      if (response && response.length > 0) {
        const data = response[0]; // Assuming we get the first record for current period
        
        const mappedData = {
          directLabour: data.Direct_Labor?.toString() || '0',
          foh: data.Factory_Over_Head?.toString() || '0',
          depresiasi: data.Depresiasi?.toString() || '0',
          mhTimbangBB: data.MH_Timbang_BB?.toString() || '0',
          mhTimbangBK: data.MH_Timbang_BK?.toString() || '0',
          mhAnalisa: data.MH_Analisa?.toString() || '0',
          biayaAnalisa: data.Biaya_Analisa?.toString() || '0',
          kwhMesin: data.Jam_KWH_Mesin_Utama?.toString() || '0',
          rateKwhMesin: data.Rate_KWH_Mesin?.toString() || '0'
        };
        
        setFormData(mappedData);
        setOriginalData(mappedData);
      } else {
        // If no data exists, use default values
        const defaultData = {
          directLabour: '0',
          foh: '0',
          depresiasi: '0',
          mhTimbangBB: '0',
          mhTimbangBK: '0',
          mhAnalisa: '0',
          biayaAnalisa: '0',
          kwhMesin: '0',
          rateKwhMesin: '0'
        };
        
        setFormData(defaultData);
        setOriginalData(defaultData);
      }
    } catch (error) {
      console.error('Error loading biaya lain data:', error);
      // On error, set default values
      const defaultData = {
        directLabour: '0',
        foh: '0',
        depresiasi: '0',
        mhTimbangBB: '0',
        mhTimbangBK: '0',
        mhAnalisa: '0',
        biayaAnalisa: '0',
        kwhMesin: '0',
        rateKwhMesin: '0'
      };
      
      setFormData(defaultData);
      setOriginalData(defaultData);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setOriginalData({ ...formData });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({ ...originalData });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const apiData = {
        directLabour: parseFloat(formData.directLabour) || 0,
        foh: parseFloat(formData.foh) || 0,
        depresiasi: parseFloat(formData.depresiasi) || 0,
        mhTimbangBB: parseFloat(formData.mhTimbangBB) || 0,
        mhTimbangBK: parseFloat(formData.mhTimbangBK) || 0,
        mhAnalisa: parseFloat(formData.mhAnalisa) || 0,
        biayaAnalisa: parseFloat(formData.biayaAnalisa) || 0,
        kwhMesin: parseFloat(formData.kwhMesin) || 0,
        rateKwhMesin: parseFloat(formData.rateKwhMesin) || 0,
        userId: "system" // You might want to get this from user context
      };
      
      await masterAPI.updateParameter(apiData);
      
      setIsEditing(false);
      setOriginalData({ ...formData });
      
      // Show success message (you can add a toast notification here)
      console.log('Biaya Lain data saved successfully');
    } catch (error) {
      console.error('Error saving biaya lain data:', error);
      // You might want to show an error message to the user here
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatNumber = (value) => {
    if (!value) return '0';
    return parseFloat(value).toLocaleString('id-ID');
  };

  const parameters = [
    {
      key: 'directLabour',
      label: 'Direct Labour',
      unit: 'IDR',
      type: 'currency'
    },
    {
      key: 'foh',
      label: 'FOH (Factory Overhead)',
      unit: 'IDR',
      type: 'currency'
    },
    {
      key: 'depresiasi',
      label: 'Depresiasi',
      unit: 'IDR',
      type: 'currency'
    },
    {
      key: 'mhTimbangBB',
      label: 'MH Timbang BB',
      unit: 'Hours',
      type: 'decimal'
    },
    {
      key: 'mhTimbangBK',
      label: 'MH Timbang BK',
      unit: 'Hours',
      type: 'decimal'
    },
    {
      key: 'mhAnalisa',
      label: 'MH Analisa',
      unit: 'Hours',
      type: 'decimal'
    },
    {
      key: 'biayaAnalisa',
      label: 'Biaya Analisa',
      unit: 'IDR',
      type: 'currency'
    },
    {
      key: 'kwhMesin',
      label: 'KwH Mesin',
      unit: 'KwH',
      type: 'decimal'
    },
    {
      key: 'rateKwhMesin',
      label: 'Rate KwH Mesin',
      unit: 'IDR/KwH',
      type: 'currency'
    }
  ];

  if (loading && !isEditing) {
    return (
      <div className="biaya-lain-page">
        <div className="biaya-lain-loading-container">
          <div className="biaya-lain-loading-spinner"></div>
          <p>Memuat data biaya lain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="biaya-lain-page">
      <div className="biaya-lain-container">
        <div className="biaya-lain-card">
          <div className="biaya-lain-card-header">
            <h2>Parameter Biaya Lain</h2>
            <div className="biaya-lain-card-actions">
              {!isEditing ? (
                <button 
                  className="biaya-lain-action-btn biaya-lain-edit-btn"
                  onClick={handleEdit}
                  disabled={loading}
                >
                  <Edit size={16} />
                  Edit
                </button>
              ) : (
                <div className="biaya-lain-edit-actions">
                  <button 
                    className="biaya-lain-action-btn biaya-lain-cancel-btn"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button 
                    className="biaya-lain-action-btn biaya-lain-save-btn"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="biaya-lain-btn-spinner"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="biaya-lain-card-content">
            <div className="biaya-lain-parameters-grid">
              {parameters.map((param) => (
                <div key={param.key} className="biaya-lain-parameter-item">
                  <div className="biaya-lain-parameter-label">
                    <span className="biaya-lain-label-text">{param.label}</span>
                    <span className="biaya-lain-label-unit">({param.unit})</span>
                  </div>
                  <div className="biaya-lain-parameter-value">
                    {isEditing ? (
                      <input
                        type="number"
                        step={param.type === 'decimal' ? '0.1' : '1'}
                        value={formData[param.key]}
                        onChange={(e) => handleInputChange(param.key, e.target.value)}
                        className="biaya-lain-parameter-input"
                        placeholder="0"
                      />
                    ) : (
                      <div className="biaya-lain-parameter-display">
                        {param.type === 'currency' ? 
                          `Rp ${formatNumber(formData[param.key])}` : 
                          formatNumber(formData[param.key])
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="biaya-lain-edit-info">
            <div className="biaya-lain-info-icon">ⓘ</div>
            <p>Anda sedang dalam mode edit. Perubahan belum tersimpan sampai Anda menekan tombol "Save".</p>
          </div>
        )}
      </div>
    </div>
  );
}
