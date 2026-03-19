import { createContext, useContext, useState, useCallback } from 'react';
import { connectWallet as connect, truncateAddress, switchToBaseSepolia } from '../services/wallet';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [role, setRole] = useState(null); // 'patient' | 'researcher'
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [familyHistory, setFamilyHistory] = useState({ members: [] });
  const [extractions, setExtractions] = useState([]);
  const [bodhiAnalysis, setBodhiAnalysis] = useState(null);
  const [mudraResult, setMudraResult] = useState(null);
  const [agentLog, setAgentLog] = useState([]);

  const connectWallet = useCallback(async (selectedRole) => {
    const addr = await connect();
    await switchToBaseSepolia();
    setWallet(addr);
    setRole(selectedRole);
    return addr;
  }, []);

  const addLogEntry = useCallback((entry) => {
    setAgentLog(prev => [...prev, { ...entry, timestamp: new Date().toISOString() }]);
  }, []);

  const resetAnalysis = useCallback(() => {
    setExtractions([]);
    setBodhiAnalysis(null);
    setMudraResult(null);
    setAgentLog([]);
  }, []);

  return (
    <AppContext.Provider value={{
      wallet, walletShort: truncateAddress(wallet), role,
      connectWallet, setRole,
      uploadedFiles, setUploadedFiles,
      familyHistory, setFamilyHistory,
      extractions, setExtractions,
      bodhiAnalysis, setBodhiAnalysis,
      mudraResult, setMudraResult,
      agentLog, addLogEntry,
      resetAnalysis,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
