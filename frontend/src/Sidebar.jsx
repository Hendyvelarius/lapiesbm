import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/src/assets/LAPILOGO_White.png" alt="LAPI Logo" className="sidebar-logo sidebar-logo-lapi" />
        <div className="sidebar-site-title">e-Sistem Biaya Manufaktur</div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">MENU UTAMA</div>
        <ul className="sidebar-menu">
          <li className="active"><span className="sidebar-icon">&#x1F4C4;</span> Input HPP</li>
          <li><span className="sidebar-icon">&#x1F4CA;</span> Laporan HPP</li>
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">PENGATURAN</div>
        <ul className="sidebar-settings">
          <li><span className="sidebar-icon">&#9881;</span> Settings</li>
          <li><span className="sidebar-icon">&#x2753;</span> Help</li>
        </ul>
      </div>
      <div className="sidebar-user">
        <div className="user-avatar">R</div>
        <div className="user-info">
          <div className="user-name">Mr. Risang</div>
          <div className="user-role">Head of Plant</div>
        </div>
      </div>
    </aside>
  );
}
