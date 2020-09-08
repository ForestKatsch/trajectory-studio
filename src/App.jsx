import React from 'react';
import './App.css';

import PageHeader from './components/page/Header.jsx';
import OrreryViewer from './components/viewer/Orrery/index.jsx';

function App() {
  return (
    <main className="App">
      <PageHeader></PageHeader>
      <OrreryViewer></OrreryViewer>
    </main>
  );
}

export default App;
