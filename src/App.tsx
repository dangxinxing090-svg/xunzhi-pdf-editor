import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PageGrid } from './components/PageGrid/PageGrid';
import { InspectorPanel } from './components/InspectorPanel/InspectorPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Sidebar />
        <PageGrid />
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  );
}
