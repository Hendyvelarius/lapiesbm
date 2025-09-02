import { useState, useEffect } from 'react';
import { Edit, Save, X } from 'lucide-react';
import { masterAPI } from '../services/api';
import '../styles/BiayaLain.css';

export default function BiayaLain() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    directLaborPN1: '0',
    directLaborPN2: '0',
    fohPN1: '0',
    fohPN2: '0',
    depresiasiPN1: '0',
    depresiasiPN2: '0',
    rateKwhMesin: '0'
  });

  const [originalData, setOriginalData] = useState({});

  // Load data on component mount
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
          directLaborPN1: data.Direct_Labor_PN1?.toString() || '0',
          directLaborPN2: data.Direct_Labor_PN2?.toString() || '0',
          fohPN1: data.Factory_Over_Head_PN1?.toString() || '0',
          fohPN2: data.Factory_Over_Head_PN2?.toString() || '0',
          depresiasiPN1: data.Depresiasi_PN1?.toString() || '0',
          depresiasiPN2: data.Depresiasi_PN2?.toString() || '0',
          rateKwhMesin: data.Rate_KWH_Mesin?.toString() || '0'
        };
        
        setFormData(mappedData);
        setOriginalData(mappedData);
      } else {
        // If no data exists, use default values with new structure
        const defaultData = {
          directLaborPN1: '0',
          directLaborPN2: '0',
          fohPN1: '0',
          fohPN2: '0',
          depresiasiPN1: '0',
          depresiasiPN2: '0',
          rateKwhMesin: '0'
        };
        
        setFormData(defaultData);
        setOriginalData(defaultData);
      }
    } catch (error) {
      console.error('Error loading biaya lain data:', error);
      // On error, set default values with new structure
      const defaultData = {
        directLaborPN1: '0',
        directLaborPN2: '0',
        fohPN1: '0',
        fohPN2: '0',
        depresiasiPN1: '0',
        depresiasiPN2: '0',
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
        directLaborPN1: parseFloat(formData.directLaborPN1) || 0,
        directLaborPN2: parseFloat(formData.directLaborPN2) || 0,
        fohPN1: parseFloat(formData.fohPN1) || 0,
        fohPN2: parseFloat(formData.fohPN2) || 0,
        depresiasiPN1: parseFloat(formData.depresiasiPN1) || 0,
        depresiasiPN2: parseFloat(formData.depresiasiPN2) || 0,
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

  // Define parameter groups for 2x2 grid layout
  const parameterGroups = [
    {
      title: 'Direct Labor',
      parameters: [
        {
          key: 'directLaborPN1',
          label: 'Direct Labor PN1',
          unit: 'IDR',
          type: 'currency'
        },
        {
          key: 'directLaborPN2',
          label: 'Direct Labor PN2',
          unit: 'IDR',
          type: 'currency'
        }
      ]
    },
    {
      title: 'Factory Overhead',
      parameters: [
        {
          key: 'fohPN1',
          label: 'FOH PN1',
          unit: 'IDR',
          type: 'currency'
        },
        {
          key: 'fohPN2',
          label: 'FOH PN2',
          unit: 'IDR',
          type: 'currency'
        }
      ]
    },
    {
      title: 'Depresiasi',
      parameters: [
        {
          key: 'depresiasiPN1',
          label: 'Depresiasi PN1',
          unit: 'IDR',
          type: 'currency'
        },
        {
          key: 'depresiasiPN2',
          label: 'Depresiasi PN2',
          unit: 'IDR',
          type: 'currency'
        }
      ]
    },
    {
      title: 'Rate KWH Mesin',
      parameters: [
        {
          key: 'rateKwhMesin',
          label: 'Rate KWH Mesin',
          unit: 'IDR/KWH',
          type: 'currency'
        }
      ]
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
            <h2>Parameter Biaya Umum</h2>
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
            <div className="biaya-lain-groups-grid">
              {parameterGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="biaya-lain-group">
                  <h3 className="biaya-lain-group-title">{group.title}</h3>
                  <div className="biaya-lain-group-parameters">
                    {group.parameters.map((param) => (
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
