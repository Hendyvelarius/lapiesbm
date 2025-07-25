import '../styles/Sidebar.css';
import { FileText, BarChart3, Settings, HelpCircle } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/LAPILOGO_White.png" alt="LAPI Logo" className="sidebar-logo sidebar-logo-lapi" />
        <div className="sidebar-site-title">e-Sistem Biaya Manufaktur</div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">MENU UTAMA</div>
        <ul className="sidebar-menu">
          <li className="active"><FileText className="sidebar-icon" size={20} /> Input HPP</li>
          <li><BarChart3 className="sidebar-icon" size={20} /> Laporan HPP</li>
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">PENGATURAN</div>
        <ul className="sidebar-settings">
          <li><Settings className="sidebar-icon" size={20} /> Settings</li>
          <li><HelpCircle className="sidebar-icon" size={20} /> Help</li>
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
