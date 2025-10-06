import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Calculator, Users, Layers, CalendarX, FlaskConical } from 'lucide-react';
import BiayaLain from './BiayaLain';
import ProductGroup from './ProductGroup';
import Pembebanan from './Pembebanan';
import ExpiryCost from './ExpiryCost';
import Reagen from './Reagen';
import '../styles/CostManagement.css';

const CostManagement = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('general-costs');

  // Initialize active tab from URL parameters
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ['general-costs', 'product-group', 'cost-allocation', 'expiry-cost', 'reagen'];
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
    },
    {
      id: 'reagen',
      label: 'Reagen',
      icon: FlaskConical,
      component: Reagen
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