import React from 'react';
import './App.css';

import PageHeader from './components/page/Header.jsx';
import StellarViewer from './components/viewer/Stellar/index.jsx';

function App() {
  return (
    <main className="App">
      <PageHeader></PageHeader>
      <StellarViewer></StellarViewer>
    </main>
  );
}

export default App;
