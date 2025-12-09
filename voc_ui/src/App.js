// Requires: npm install react-router-dom@6
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Analysis from './pages/analysis';

const App = () => (
  <BrowserRouter>
    <Routes>
      
      <Route path="/" element={<Analysis />} />
      <Route path="/analysis" element={<Analysis />} />
    </Routes>
  </BrowserRouter>
);

export default App;
