import React from 'react';
import './App.css';

function App() {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ color: '#333', marginBottom: '10px' }}>✅ POS System Desktop</h1>
      <p style={{ color: '#666', fontSize: '16px', marginBottom: '20px' }}>
        Congratulations! The application is running successfully.
      </p>
      
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>System Status:</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ margin: '8px 0' }}>
            <strong>Electron:</strong> ✅ Running
          </li>
          <li style={{ margin: '8px 0' }}>
            <strong>React:</strong> ✅ Rendering
          </li>
          <li style={{ margin: '8px 0' }}>
            <strong>IPC Bridge:</strong> {typeof window !== 'undefined' && window.pos ? '✅ Available' : '❌ Not Available'}
          </li>
          <li style={{ margin: '8px 0' }}>
            <strong>Backend API:</strong> {typeof window !== 'undefined' && window.pos && window.pos.auth ? '✅ Connected' : '❌ Not Connected'}
          </li>
        </ul>
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        backgroundColor: '#e8f5e9', 
        borderRadius: '8px',
        border: '1px solid #4caf50'
      }}>
        <strong>Next Steps:</strong>
        <p style={{ margin: '10px 0 0 0' }}>
          The full application is under development. Replace this file with your actual app components.
        </p>
      </div>
    </div>
  );
}

export default App;
