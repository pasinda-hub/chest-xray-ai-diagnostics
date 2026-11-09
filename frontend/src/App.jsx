import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const [patientId, setPatientId] = useState('PT-001');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const API_URL = 'http://localhost:8000';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch scan history", err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.name.endsWith('.dcm')) {
        setPreview(null);
      } else {
        setPreview(URL.createObjectURL(selectedFile));
      }
      setResult(null);
      setShowHeatmap(false);
      setError('');
    }
  };

  const handleDiagnosis = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an X-ray scan file first.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/diagnose`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      setShowHeatmap(false);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setError('Neural inference connection failed. Ensure backend is active.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDFReport = () => {
    if (!result) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Clinical_Diagnostic_Report_${patientId}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h2 { margin: 0; color: #0f172a; font-size: 22px; letter-spacing: -0.5px; }
            .header p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .meta-item font { font-size: 11px; color: #64748b; display: block; text-transform: uppercase; }
            .meta-item span { font-size: 15px; font-weight: bold; color: #0f172a; }
            .primary-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
            .primary-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
            .primary-val { font-size: 24px; font-weight: 800; color: #1d4ed8; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
            th { background-color: #f1f5f9; color: #334155; font-weight: 600; text-transform: uppercase; font-size: 11px; }
            .sig-section { margin-top: 50px; display: flex; justify-content: space-between; }
            .sig-line { width: 250px; border-top: 1px solid #0f172a; text-align: center; padding-top: 5px; font-size: 12px; color: #64748b; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>AI Clinical Diagnostic Report</h2>
              <p>DenseNet121 Neural Classification Engine + Grad-CAM Explainability</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 12px; color: #64748b;">Generated: ${new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-item">
              <font>Patient Identifier</font>
              <span>${patientId}</span>
            </div>
            <div class="meta-item">
              <font>Inference Pipeline</font>
              <span>PyTorch CPU State-less Model</span>
            </div>
          </div>

          <div class="primary-box">
            <h3>Primary Diagnostic Finding</h3>
            <p class="primary-val">${result.primary_finding}</p>
            <p style="margin:5px 0 0 0; font-size: 13px; color: #3b82f6; font-weight: 600;">Model Confidence Score: ${result.confidence.toFixed(2)}%</p>
          </div>

          <div>
            <h3 style="font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Comprehensive Condition Screening Matrix</h3>
            <table>
              <thead>
                <tr>
                  <th>Pathology Condition</th>
                  <th style="text-align: right;">Probability Confidence</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(result.all_scores)
                  .map(
                    ([condition, score]) => `
                  <tr>
                    <td>${condition}</td>
                    <td style="text-align: right; font-weight: 600; color: ${score > 50 ? '#1d4ed8' : '#334155'};">${score.toFixed(1)}%</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="sig-section">
            <div class="sig-line">Attending Physician Signature</div>
            <div class="sig-line">Radiology Verification Stamp</div>
          </div>

          <div class="footer">
            <p>CONFIDENTIAL MEDICAL REPORT — AI-generated screening output. Requires mandatory clinical correlation and physician verification.</p>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col items-center justify-between py-6 sm:py-10 px-3 sm:px-6 xl:px-12 selection:bg-cyan-500 selection:text-black ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-grow">
        
        {/* Header */}
        <div className={`w-full mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 sm:pb-6 gap-4 transition-colors ${
          darkMode ? 'border-slate-800' : 'border-slate-300'
        }`}>
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full animate-pulse ${
                darkMode ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)]'
              }`}></span>
              <h1 className={`text-xl sm:text-2xl xl:text-3xl font-black tracking-tight uppercase font-mono ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                NeuralCXR<span className={darkMode ? 'text-cyan-400' : 'text-blue-600'}>.ai</span>
              </h1>
            </div>
            <p className={`text-[10px] sm:text-xs mt-1 uppercase tracking-widest font-mono ${
              darkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Autonomous Multi-Label Thoracic Screening Matrix + Grad-CAM AI
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono transition border shadow-sm cursor-pointer ${
                darkMode ? 'bg-slate-900 border-slate-800 text-cyan-400 hover:bg-slate-800' : 'bg-white border-slate-300 text-blue-600 hover:bg-slate-50'
              }`}
            >
              <span>Audit History ({history.length})</span>
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono transition border shadow-sm cursor-pointer ${
                darkMode ? 'bg-slate-900 border-slate-800 text-yellow-400 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <div className={`px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-mono shadow-inner border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
            }`}>
              <span className="text-emerald-500 font-bold">● ONLINE</span>
            </div>
          </div>
        </div>

        {/* Audit History Drawer */}
        {showHistory && (
          <div className={`mb-6 p-4 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-xl`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">Recent Audit Log History</h3>
              <button onClick={() => setShowHistory(false)} className="text-xs text-rose-400 cursor-pointer">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className={`p-3 rounded-xl border text-xs ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="font-mono font-bold text-cyan-400">Patient: {item.patient_id}</p>
                  <p className="font-semibold mt-1">Finding: {item.primary_finding} ({item.confidence.toFixed(1)}%)</p>
                  <p className="text-[10px] text-slate-400 mt-1">{item.timestamp}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid Workspace */}
        <div className={`w-full backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 xl:p-10 border grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 transition-colors ${
          darkMode ? 'bg-slate-900/80 border-slate-800/80 text-slate-100' : 'bg-white/90 border-slate-200 text-slate-800'
        }`}>
          
          {/* Left Column: Upload & Scan Control */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <form onSubmit={handleDiagnosis} className="space-y-4 sm:space-y-5">
              <div>
                <label className={`block text-xs font-mono uppercase tracking-wider mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Patient Identifier</label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition font-mono ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-mono uppercase tracking-wider mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>DICOM / X-Ray Image Asset</label>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 sm:p-6 cursor-pointer transition group ${
                  darkMode ? 'border-slate-700/80 hover:border-cyan-500/60 bg-slate-950/50 hover:bg-slate-950 text-slate-300' : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}>
                  <svg className={`w-8 h-8 mb-2 transition ${darkMode ? 'text-slate-500 group-hover:text-cyan-400' : 'text-slate-400 group-hover:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span className="text-xs font-medium text-center truncate max-w-full">
                    {file ? file.name : "Select JPG, PNG or DICOM (.dcm)"}
                  </span>
                  <input type="file" accept="image/*,.dcm" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {preview && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black h-48 sm:h-56 flex flex-col items-center justify-center shadow-inner">
                  <img 
                    src={showHeatmap && result?.heatmap ? result.heatmap : preview} 
                    alt="Scan Preview" 
                    className="max-h-full object-contain filter contrast-110" 
                  />
                  <div className="absolute top-2 left-2 flex gap-2">
                    <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-400 border border-cyan-500/30">
                      {showHeatmap ? "GRAD-CAM HEATMAP" : "RAW SCAN"}
                    </div>
                  </div>
                  {result?.heatmap && (
                    <button
                      type="button"
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className="absolute bottom-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg shadow-md transition cursor-pointer"
                    >
                      {showHeatmap ? "View Original X-Ray" : "Toggle Grad-CAM Heatmap"}
                    </button>
                  )}
                </div>
              )}

              {error && <p className="text-rose-400 text-xs font-mono bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold uppercase tracking-wider text-xs py-4 px-4 rounded-xl shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer font-mono ${
                  darkMode ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                }`}
              >
                {loading ? 'Running Neural Inference...' : 'Execute AI Diagnosis'}
              </button>
            </form>
          </div>

          {/* Right Column: Diagnostic Matrix & Output */}
          <div className={`lg:col-span-7 rounded-2xl border p-4 sm:p-6 flex flex-col justify-between ${
            darkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className={`flex justify-between items-center mb-4 border-b pb-3 ${darkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                <h2 className="text-sm font-mono uppercase tracking-wider font-bold">Diagnostic Findings & Explainability</h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  darkMode ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/50' : 'text-blue-600 bg-blue-50 border-blue-200'
                }`}>GRAD-CAM ACTIVE</span>
              </div>
              
              {result ? (
                <div className="space-y-4 sm:space-y-5 animate-fadeIn">
                  <div className={`p-4 sm:p-5 rounded-2xl shadow-lg relative overflow-hidden border ${
                    darkMode ? 'bg-gradient-to-br from-blue-950/40 to-slate-900 border-blue-500/30 text-white' : 'bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200 text-slate-900'
                  }`}>
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-semibold ${darkMode ? 'text-cyan-400' : 'text-blue-600'}`}>Primary Pathology Detected</span>
                    <p className="text-xl sm:text-2xl font-black mt-1">{result.primary_finding}</p>
                    <div className={`mt-3 flex items-center justify-between text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span>Confidence Metric:</span>
                      <span className={`font-bold ${darkMode ? 'text-cyan-400' : 'text-blue-600'}`}>{result.confidence.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-xs font-mono uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Complete Condition Breakdown</h3>
                    <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
                      {Object.entries(result.all_scores).map(([condition, score]) => (
                        <div key={condition} className={`border p-3 rounded-xl text-xs flex justify-between items-center ${
                          darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                        }`}>
                          <span className="font-medium">{condition}</span>
                          <span className={`font-mono font-bold ${score > 50 ? (darkMode ? 'text-cyan-400' : 'text-blue-600') : 'text-slate-400'}`}>{score.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`h-64 sm:h-72 flex flex-col items-center justify-center text-xs font-mono text-center space-y-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>Awaiting X-Ray scan ingestion & neural forward pass...</span>
                </div>
              )}
            </div>

            {result && (
              <button
                onClick={downloadPDFReport}
                className={`mt-6 w-full font-mono font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg border cursor-pointer ${
                  darkMode ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800' : 'bg-white border-slate-300 text-blue-600 hover:bg-slate-50'
                }`}
              >
                Export Clinical PDF Report
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}