import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Calculator, Users, Layers, CalendarX } from 'lucide-react';
import BiayaLain from './BiayaLain';
import ProductGroup from './ProductGroup';
import Pembebanan from './Pembebanan';
import ExpiryCost from './ExpiryCost';
import '../styles/CostManagement.css';

const CostManagement = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general-costs');

  // Initialize active tab from URL parameters
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ['general-costs', 'product-group', 'cost-allocation', 'expiry-cost'];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const tabs = [
    {
      id: 'general-costs',
      label: 'General Costs',
      icon: Calculator,
      component: BiayaLain
    },
    {
      id: 'product-group',
      label: 'Product Group',
      icon: Users,
      component: ProductGroup
    },
    {
      id: 'cost-allocation',
      label: 'Cost Allocation',
      icon: Layers,
      component: Pembebanan
    },
    {
      id: 'expiry-cost',
      label: 'Expiry Cost',
      icon: CalendarX,
      component: ExpiryCost
    }
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="cost-management-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <div className="tab-header">
          <h1>Cost Management</h1>
          <p>Manage all cost-related configurations and parameters</p>
        </div>
        <div className="tab-buttons">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                <IconComponent size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {ActiveComponent && <ActiveComponent user={user} />}
      </div>
    </div>
  );
};

export default CostManagement;