import React from 'react';
import './App.css';

import PageHeader from './components/page/Header.tsx';
import StellarViewer from './components/viewer/Stellar/index.tsx';

function App() {
  return (
    <main className="App">
      <PageHeader></PageHeader>
      <StellarViewer></StellarViewer>
    </main>
  );
}

export default App;
