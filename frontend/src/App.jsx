
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import InputHPP from './InputHPP';
import './App.css';

function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <TopNavbar />
      <main className="main-content">
        <InputHPP />
      </main>
    </div>
  );
}

export default App;
