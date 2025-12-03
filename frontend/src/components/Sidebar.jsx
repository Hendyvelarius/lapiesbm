import '../styles/Sidebar.css';
import { FileText, BarChart3, DollarSign, Package, Calculator, Users, Layers, FlaskConical, Settings, CalendarX, ClipboardList, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export default function Sidebar({ user }) {
  const location = useLocation();
  
  // Extract user information with fallbacks
  const userName = user?.nama || user?.inisialNama || 'User';
  const userRole = user?.jabatan || 'Unknown Position';
  
    return (
      <aside className="sidebar">
        {/* Sticky Top Section */}
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <img src="./LAPILOGO_White.png" alt="LAPI Logo" className="logo-image" />
          </div>
          <div className="sidebar-header">
            <div className="sidebar-site-title">Harga Pokok Penjualan</div>
          </div>
        </div>
        {/* Scrollable Menu Section */}
        <div className="sidebar-menu-scroll">
          <div className="sidebar-section-title">MAIN MENU</div>
          <ul className="sidebar-menu">
            <li className={location.pathname === '/' ? 'active' : ''}>
              <Link to="/" className="sidebar-link">
                <BarChart3 className="sidebar-icon" size={20} /> Dashboard
              </Link>
            </li>
            <li className={location.pathname === '/currency' ? 'active' : ''}>
              <Link to="/currency" className="sidebar-link">
                <DollarSign className="sidebar-icon" size={20} /> Exchange Rates
              </Link>
            </li>
            <li className={location.pathname === '/cost-management' ? 'active' : ''}>
              <Link to="/cost-management" className="sidebar-link">
                <Calculator className="sidebar-icon" size={20} /> Cost Management
              </Link>
            </li>
            <li className={location.pathname === '/harga-bahan' ? 'active' : ''}>
              <Link to="/harga-bahan" className="sidebar-link">
                <Package className="sidebar-icon" size={20} /> Material Prices
              </Link>
            </li>
            <li className={location.pathname === '/product-formula' ? 'active' : ''}>
              <Link to="/product-formula" className="sidebar-link">
                <FlaskConical className="sidebar-icon" size={20} /> Product Formula
              </Link>
            </li>
            <li className={location.pathname === '/formula-assignment' ? 'active' : ''}>
              <Link to="/formula-assignment" className="sidebar-link">
                <Settings className="sidebar-icon" size={20} /> Formula Assignment
              </Link>
            </li>
            <li className={location.pathname === '/hpp-simulation' ? 'active' : ''}>
              <Link to="/hpp-simulation" className="sidebar-link">
                <FileText className="sidebar-icon" size={20} /> HPP Simulation
              </Link>
            </li>
            <li className={location.pathname === '/generate-hpp' ? 'active' : ''}>
              <Link to="/generate-hpp" className="sidebar-link">
                <Calculator className="sidebar-icon" size={20} /> Generate HPP
              </Link>
            </li>
            <li className={location.pathname === '/hpp-results' ? 'active' : ''}>
              <Link to="/hpp-results" className="sidebar-link">
                <ClipboardList className="sidebar-icon" size={20} /> HPP Results
              </Link>
            </li>
          </ul>
        </div>
        {/* Sticky Bottom Section */}
        <div className="sidebar-user">
          <div className="user-avatar">
            <User size={20} color="#ffffff" />
          </div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole}</div>
          </div>
        </div>
      </aside>
    );
}
