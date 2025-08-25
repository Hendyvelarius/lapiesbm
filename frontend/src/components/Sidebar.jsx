import '../styles/Sidebar.css';
import { FileText, BarChart3, DollarSign, Package, Calculator, Users, Layers, FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export default function Sidebar() {
  const location = useLocation();
  
  return (
    <aside className="sidebar">
      {/* Logo Section */}
      <div className="sidebar-logo">
        <img src="/LAPILOGO_White.png" alt="LAPI Logo" className="logo-image" />
      </div>
      <div className="sidebar-header">
        <div className="sidebar-site-title">e-Sistem Biaya Manufaktur</div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">MENU UTAMA</div>
        <ul className="sidebar-menu">
          <li className={location.pathname === '/' ? 'active' : ''}>
            <Link to="/" className="sidebar-link">
              <BarChart3 className="sidebar-icon" size={20} /> Laporan HPP
            </Link>
          </li>
          <li className={location.pathname === '/hpp-simulation' ? 'active' : ''}>
            <Link to="/hpp-simulation" className="sidebar-link">
              <FileText className="sidebar-icon" size={20} /> Simulasi HPP
            </Link>
          </li>
          <li className={location.pathname === '/kurs' ? 'active' : ''}>
            <Link to="/kurs" className="sidebar-link">
              <DollarSign className="sidebar-icon" size={20} /> Info Kurs
            </Link>
          </li>
          <li className={location.pathname === '/harga-bahan' ? 'active' : ''}>
            <Link to="/harga-bahan" className="sidebar-link">
              <Package className="sidebar-icon" size={20} /> Harga Bahan
            </Link>
          </li>
          <li className={location.pathname === '/biaya-lain' ? 'active' : ''}>
            <Link to="/biaya-lain" className="sidebar-link">
              <Calculator className="sidebar-icon" size={20} /> Biaya Lain
            </Link>
          </li>
          <li className={location.pathname === '/product-group' ? 'active' : ''}>
            <Link to="/product-group" className="sidebar-link">
              <Users className="sidebar-icon" size={20} /> Product Group
            </Link>
          </li>
          <li className={location.pathname === '/pembebanan' ? 'active' : ''}>
            <Link to="/pembebanan" className="sidebar-link">
              <Layers className="sidebar-icon" size={20} /> Pembebanan
            </Link>
          </li>
          <li className={location.pathname === '/productformula' ? 'active' : ''}>
            <Link to="/productformula" className="sidebar-link">
              <FlaskConical className="sidebar-icon" size={20} /> Product Formula
            </Link>
          </li>
        </ul>
      </div>
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
