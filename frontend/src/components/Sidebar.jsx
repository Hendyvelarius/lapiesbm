import '../styles/Sidebar.css';
import { FileText, BarChart3, DollarSign, Package, Calculator, Users, Layers, FlaskConical, Settings, CalendarX } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export default function Sidebar() {
  const location = useLocation();
  
    return (
      <aside className="sidebar">
        {/* Sticky Top Section */}
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <img src="/LAPILOGO_White.png" alt="LAPI Logo" className="logo-image" />
          </div>
          <div className="sidebar-header">
            <div className="sidebar-site-title">e-Sistem Biaya Manufaktur</div>
          </div>
        </div>
        {/* Scrollable Menu Section */}
        <div className="sidebar-menu-scroll">
          <div className="sidebar-section-title">MAIN MENU</div>
          <ul className="sidebar-menu">
            <li className={location.pathname === '/' ? 'active' : ''}>
              <Link to="/" className="sidebar-link">
                <BarChart3 className="sidebar-icon" size={20} /> HPP Report
              </Link>
            </li>
            <li className={location.pathname === '/hpp-simulation' ? 'active' : ''}>
              <Link to="/hpp-simulation" className="sidebar-link">
                <FileText className="sidebar-icon" size={20} /> HPP Simulation
              </Link>
            </li>
            <li className={location.pathname === '/currency' ? 'active' : ''}>
              <Link to="/currency" className="sidebar-link">
                <DollarSign className="sidebar-icon" size={20} /> Exchange Rates
              </Link>
            </li>
            <li className={location.pathname === '/harga-bahan' ? 'active' : ''}>
              <Link to="/harga-bahan" className="sidebar-link">
                <Package className="sidebar-icon" size={20} /> Material Prices
              </Link>
            </li>
            <li className={location.pathname === '/biaya-lain' ? 'active' : ''}>
              <Link to="/biaya-lain" className="sidebar-link">
                <Calculator className="sidebar-icon" size={20} /> General Costs
              </Link>
            </li>
            <li className={location.pathname === '/product-group' ? 'active' : ''}>
              <Link to="/product-group" className="sidebar-link">
                <Users className="sidebar-icon" size={20} /> Product Group
              </Link>
            </li>
            <li className={location.pathname === '/pembebanan' ? 'active' : ''}>
              <Link to="/pembebanan" className="sidebar-link">
                <Layers className="sidebar-icon" size={20} /> Cost Allocation
              </Link>
            </li>
            <li className={location.pathname === '/formula-assignment' ? 'active' : ''}>
              <Link to="/formula-assignment" className="sidebar-link">
                <Settings className="sidebar-icon" size={20} /> Formula Assignment
              </Link>
            </li>
            <li className={location.pathname === '/product-formula' ? 'active' : ''}>
              <Link to="/product-formula" className="sidebar-link">
                <FlaskConical className="sidebar-icon" size={20} /> Product Formula
              </Link>
            </li>
            {/* Generate HPP Button */}
            <li className={location.pathname === '/generate-hpp' ? 'active' : ''}>
              <Link to="/generate-hpp" className="sidebar-link">
                <Calculator className="sidebar-icon" size={20} /> Generate HPP
              </Link>
            </li>
            {/* Expiry Cost Management */}
            <li className={location.pathname === '/expiry-cost' ? 'active' : ''}>
              <Link to="/expiry-cost" className="sidebar-link">
                <CalendarX className="sidebar-icon" size={20} /> Expiry Cost
              </Link>
            </li>
          </ul>
        </div>
        {/* Sticky Bottom Section */}
        <div className="sidebar-user">
          <div className="user-avatar">R</div>
          <div className="user-info">
            <div className="user-name">Gunawan</div>
            <div className="user-role">NT Supervisor</div>
          </div>
        </div>
      </aside>
    );
}
