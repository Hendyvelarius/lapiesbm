import React, { useState } from 'react';
import '../styles/GenerateHPP.css';
import { CheckCircle, Calculator, Database, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import ValidationModal from '../components/ValidationModal';

export default function GenerateHPP() {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatus, setStepStatus] = useState({
    validation: 'pending', // pending, running, completed, failed
    calculation: 'pending',
    posting: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const steps = [
    {
      number: 1,
      title: 'Validation Check',
      description: 'Verify formula assignments, material prices, and data integrity before calculation',
      icon: CheckCircle,
      action: 'Check',
      status: stepStatus.validation
    },
    {
      number: 2,
      title: 'HPP Calculation',
      description: 'Calculate Cost of Goods Sold (HPP) for all products based on assigned formulas',
      icon: Calculator,
      action: 'Calculate',
      status: stepStatus.calculation
    },
    {
      number: 3,
      title: 'Post to Database',
      description: 'Save calculated HPP values to the database and update product records',
      icon: Database,
      action: 'Post',
      status: stepStatus.posting
    }
  ];

  const getStepStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon completed" size={20} />;
      case 'warning':
        return <AlertTriangle className="status-icon warning" size={20} />;
      case 'running':
        return <Clock className="status-icon running" size={20} />;
      case 'failed':
        return <AlertTriangle className="status-icon failed" size={20} />;
      default:
        return null;
    }
  };

  const getStepStatusClass = (step, status) => {
    if (status === 'completed') return 'completed';
    if (status === 'warning') return 'warning';
    if (status === 'running') return 'running';
    if (status === 'failed') return 'failed';
    if (step <= currentStep) return 'active';
    return 'disabled';
  };

  const handleStepAction = async (stepNumber) => {
    if (stepNumber > currentStep) return; // Can't skip steps
    
    if (stepNumber === 1) {
      // Open validation modal for step 1
      setShowValidationModal(true);
    } else if (stepNumber === 2) {
      // Calculation
      setLoading(true);
      setStepStatus(prev => ({ ...prev, calculation: 'running' }));
      // TODO: Implement calculation logic
      setTimeout(() => {
        setStepStatus(prev => ({ ...prev, calculation: 'completed' }));
        setCurrentStep(3);
        setLoading(false);
      }, 3000);
    } else if (stepNumber === 3) {
      // Post to Database
      setLoading(true);
      setStepStatus(prev => ({ ...prev, posting: 'running' }));
      // TODO: Implement posting logic
      setTimeout(() => {
        setStepStatus(prev => ({ ...prev, posting: 'completed' }));
        setLoading(false);
      }, 2000);
    }
  };

  const handleValidationComplete = (result) => {
    if (result === 'success') {
      setStepStatus(prev => ({ ...prev, validation: 'completed' }));
      setCurrentStep(2);
      setShowValidationModal(false); // Close modal on success
    } else if (result === 'warning') {
      setStepStatus(prev => ({ ...prev, validation: 'warning' }));
      setCurrentStep(2);
      // Don't close modal on warning - let user see the warnings and decide
    } else {
      setStepStatus(prev => ({ ...prev, validation: 'failed' }));
      // Keep modal open on failure - don't close it
      // Don't advance to next step
    }
  };

  const handleValidationClose = () => {
    setShowValidationModal(false);
  };

  const resetProcess = () => {
    setCurrentStep(1);
    setStepStatus({
      validation: 'pending',
      calculation: 'pending',
      posting: 'pending'
    });
    setShowValidationModal(false); // Close modal if it's open
  };

  return (
    <div className="generate-hpp-container">
      <div className="hpp-process-container">
        <div className="process-header">
          <h2>HPP Generation Process</h2>
          <button 
            className="btn-reset"
            onClick={resetProcess}
            disabled={loading}
          >
            Reset Process
          </button>
        </div>

        <div className="steps-container">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const statusClass = getStepStatusClass(step.number, step.status);
            
            return (
              <div key={step.number} className={`step-card ${statusClass}`}>
                <div className="step-header">
                  <div className="step-number-container">
                    <div className="step-number">{step.number}</div>
                    {getStepStatusIcon(step.status)}
                  </div>
                  <div className="step-info">
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-description">{step.description}</p>
                  </div>
                </div>
                
                <div className="step-actions">
                  <button
                    className={`btn-step ${statusClass}`}
                    onClick={() => handleStepAction(step.number)}
                    disabled={step.number > currentStep || loading || step.status === 'completed' || 
                             (step.number > 1 && stepStatus.validation === 'failed')}
                  >
                    <Icon size={18} />
                    {step.status === 'running' ? 'Processing...' : 
                     step.status === 'completed' ? 'Completed' : 
                     step.action}
                  </button>
                </div>

                {index < steps.length - 1 && (
                  <div className="step-connector">
                    <ChevronRight size={20} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="process-info">
          <div className="info-card">
            <AlertTriangle size={20} />
            <div>
              <h4>Important Notes</h4>
              <ul>
                <li>Complete validation checks before proceeding to calculation</li>
                <li>HPP calculation may take several minutes for large product catalogs</li>
                <li>Ensure all formula assignments are up-to-date before starting</li>
                <li>Database posting is final - review calculations carefully</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Validation Modal */}
      <ValidationModal 
        isOpen={showValidationModal}
        onClose={handleValidationClose}
        onValidationComplete={handleValidationComplete}
      />
    </div>
  );
}
