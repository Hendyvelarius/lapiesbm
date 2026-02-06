import { Link } from 'react-router';
import { BarChart3, FileText, DollarSign, Package, Calculator, Settings, FlaskConical, ClipboardList, Layers, ArrowRight } from 'lucide-react';
import '../styles/LandingPage.css';

export default function LandingPage({ user, accessLevel }) {
  const userName = user?.nama || user?.inisialNama || 'User';
  const hasFullAccess = accessLevel === 'full';

  // Menu items for full access users
  const fullAccessMenuItems = [
    { 
      icon: BarChart3, 
      title: 'Dashboard', 
      description: 'View key metrics and system overview',
      path: '/dashboard',
      color: '#3b82f6'
    },
    { 
      icon: FileText, 
      title: 'HPP Simulation', 
      description: 'Simulate cost calculations before applying',
      path: '/hpp-simulation',
      color: '#10b981'
    },
    { 
      icon: DollarSign, 
      title: 'Exchange Rates', 
      description: 'Manage currency exchange rates',
      path: '/currency',
      color: '#f59e0b'
    },
    { 
      icon: Calculator, 
      title: 'Cost Management', 
      description: 'Configure cost parameters and allocations',
      path: '/cost-management',
      color: '#8b5cf6'
    },
    { 
      icon: Package, 
      title: 'Material Prices', 
      description: 'Manage ingredient pricing data',
      path: '/harga-bahan',
      color: '#ec4899'
    },
    { 
      icon: FlaskConical, 
      title: 'Product Formula', 
      description: 'View and manage product formulas',
      path: '/product-formula',
      color: '#06b6d4'
    },
    { 
      icon: Settings, 
      title: 'Formula Assignment', 
      description: 'Assign formulas to products',
      path: '/formula-assignment',
      color: '#64748b'
    },
    { 
      icon: Calculator, 
      title: 'Generate HPP', 
      description: 'Generate cost of goods sold calculations',
      path: '/generate-hpp',
      color: '#ef4444'
    },
    { 
      icon: ClipboardList, 
      title: 'HPP Standard', 
      description: 'View standard HPP results',
      path: '/hpp-results',
      color: '#14b8a6'
    },
    { 
      icon: Layers, 
      title: 'HPP Actual', 
      description: 'View actual HPP calculations',
      path: '/hpp-actual',
      color: '#f97316'
    },
  ];

  // Menu items for limited access users
  const limitedAccessMenuItems = [
    { 
      icon: FileText, 
      title: 'HPP Simulation', 
      description: 'Simulate cost calculations for analysis',
      path: '/hpp-simulation',
      color: '#10b981'
    },
  ];

  const menuItems = hasFullAccess ? fullAccessMenuItems : limitedAccessMenuItems;

  return (
    <div className="landing-page">
      <div className="landing-header">
        <h1>Welcome, {userName}</h1>
        <p className="landing-subtitle">
          {hasFullAccess 
            ? 'Manufacturing Cost System - Full Access'
            : 'Manufacturing Cost System - Limited Access'
          }
        </p>
      </div>

      <div className="landing-content">
        <h2 className="section-title">
          {hasFullAccess ? 'Quick Access' : 'Available Features'}
        </h2>
        
        <div className={`menu-grid ${hasFullAccess ? 'full-grid' : 'limited-grid'}`}>
          {menuItems.map((item, index) => (
            <Link 
              to={item.path} 
              key={index} 
              className="menu-card"
              style={{ '--card-accent': item.color }}
            >
              <div className="menu-card-icon" style={{ backgroundColor: item.color }}>
                <item.icon size={24} color="#ffffff" />
              </div>
              <div className="menu-card-content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <ArrowRight className="menu-card-arrow" size={20} />
            </Link>
          ))}
        </div>

        {!hasFullAccess && (
          <div className="limited-access-notice">
            <h3>🔒 Limited Access Account</h3>
            <p>
              Your account has limited access to this application. 
              You can use the HPP Simulation feature to analyze manufacturing costs.
            </p>
            <p>
              If you need access to additional features such as Dashboard, Material Prices, 
              or Cost Management, please contact your system administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
