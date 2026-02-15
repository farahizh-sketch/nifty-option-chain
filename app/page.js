'use client';

import { useState, useEffect } from 'react';

export default function OptionChainAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [buyQuantity, setBuyQuantity] = useState(65);
  const [buyQuantityInput, setBuyQuantityInput] = useState('65');
  const [positions, setPositions] = useState([]);
  const [userId, setUserId] = useState('');
  const [walletBalance, setWalletBalance] = useState(1000000);
  const [showUserSetup, setShowUserSetup] = useState(true);
  const [limitOrderModal, setLimitOrderModal] = useState({ show: false, positionId: null, target: '', sl: '' });

  // Fetch data from API
  const fetchData = async () => {
    try {
      const response = await fetch('https://myoption.vercel.app/api/option-chain');
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load persisted state
    const savedUserId = localStorage.getItem('trader_userId');
    const savedBalance = localStorage.getItem('trader_walletBalance');
    const savedPositions = localStorage.getItem('trader_positions');

    if (savedUserId) {
      setUserId(savedUserId);
      setShowUserSetup(false);
    }
    if (savedBalance) {
      setWalletBalance(parseFloat(savedBalance));
    }
    if (savedPositions) {
      setPositions(JSON.parse(savedPositions));
    }

    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Autonomous SL/Target Check
  useEffect(() => {
    if (!data?.data || positions.length === 0) return;

    positions.forEach(pos => {
      const currentPrice = getCurrentPrice(pos.symbol);
      if (currentPrice <= 0) return;

      // Check Stop Loss
      if (pos.stopLossPrice && currentPrice <= pos.stopLossPrice) {
        handleAutoExit(pos.id, 'Stop Loss Hit');
      }
      // Check Target
      else if (pos.targetPrice && currentPrice >= pos.targetPrice) {
        handleAutoExit(pos.id, 'Target Achieved');
      }
    });
  }, [data, positions]);

  const handleAutoExit = (positionId, reason) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const currentPrice = getCurrentPrice(position.symbol);
    const proceeds = currentPrice * position.quantity;

    setPositions(prev => prev.filter(p => p.id !== positionId));
    setWalletBalance(prev => prev + proceeds);

    alert(`⚡ AUTO EXIT: ${reason}\n\nSymbol: ${position.symbol}\nExit Price: ₹${currentPrice.toFixed(2)}\nProceeds: ₹${proceeds.toFixed(2)}`);
  };

  // Persist state changes
  useEffect(() => {
    if (userId) localStorage.setItem('trader_userId', userId);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('trader_walletBalance', walletBalance.toString());
  }, [walletBalance]);

  useEffect(() => {
    localStorage.setItem('trader_positions', JSON.stringify(positions));
  }, [positions]);

  // Calculate PCR (Put-Call Ratio)
  const calculatePCR = () => {
    if (!data?.data) return { oiPCR: 0, volumePCR: 0 };

    let totalCallOI = 0, totalPutOI = 0;
    let totalCallVolume = 0, totalPutVolume = 0;

    Object.entries(data.data).forEach(([symbol, optionData]) => {
      if (symbol.includes('CE')) {
        totalCallOI += optionData.oi || 0;
        totalCallVolume += optionData.volume || 0;
      } else if (symbol.includes('PE')) {
        totalPutOI += optionData.oi || 0;
        totalPutVolume += optionData.volume || 0;
      }
    });

    return {
      oiPCR: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0,
      volumePCR: totalCallVolume > 0 ? (totalPutVolume / totalCallVolume).toFixed(2) : 0
    };
  };

  // Calculate Max Pain
  const calculateMaxPain = () => {
    if (!data?.data || !data?.strikes) return { strike: 0, pain: 0 };

    const painByStrike = {};

    data.strikes.forEach(strike => {
      let totalPain = 0;

      Object.entries(data.data).forEach(([symbol, optionData]) => {
        const strikeFromSymbol = parseInt(symbol.match(/\d{5}(?=CE|PE)/)?.[0]);

        if (symbol.includes('CE')) {
          // Call writers lose money when price > strike
          if (data.spot > strikeFromSymbol) {
            totalPain += (data.spot - strikeFromSymbol) * (optionData.oi || 0);
          }
        } else if (symbol.includes('PE')) {
          // Put writers lose money when price < strike
          if (data.spot < strikeFromSymbol) {
            totalPain += (strikeFromSymbol - data.spot) * (optionData.oi || 0);
          }
        }
      });

      painByStrike[strike] = totalPain;
    });

    const maxPainStrike = Object.entries(painByStrike).reduce((min, [strike, pain]) =>
      pain < min.pain ? { strike: parseInt(strike), pain } : min
      , { strike: 0, pain: Infinity });

    return maxPainStrike;
  };

  // Get option data by strike
  const getOptionsByStrike = () => {
    if (!data?.data || !data?.strikes) return [];

    return data.strikes.map(strike => {
      const ceSymbol = Object.keys(data.data).find(s => s.includes(`${strike}CE`));
      const peSymbol = Object.keys(data.data).find(s => s.includes(`${strike}PE`));

      return {
        strike,
        call: ceSymbol ? data.data[ceSymbol] : null,
        put: peSymbol ? data.data[peSymbol] : null,
        callSymbol: ceSymbol,
        putSymbol: peSymbol,
        isATM: strike === data.atm
      };
    });
  };

  // Format number with commas
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString('en-IN');
  };

  // Get moneyness class
  const getMoneyness = (strike, type) => {
    if (!data?.spot) return '';
    if (type === 'CE') {
      if (strike < data.spot) return 'itm';
      if (strike === data.atm) return 'atm';
      return 'otm';
    } else {
      if (strike > data.spot) return 'itm';
      if (strike === data.atm) return 'atm';
      return 'otm';
    }
  };

  // Handle buy at market
  const handleBuyAtMarket = (symbol, price, type) => {
    const totalCost = price * buyQuantity;

    // Check if sufficient balance
    if (totalCost > walletBalance) {
      alert(`Insufficient Balance!\n\nRequired: ₹${totalCost.toFixed(2)}\nAvailable: ₹${walletBalance.toFixed(2)}`);
      return;
    }

    const newPosition = {
      id: Date.now(),
      symbol,
      type, // 'CE' or 'PE'
      buyPrice: price,
      quantity: buyQuantity,
      timestamp: new Date().toLocaleString()
    };

    // Add to positions and deduct from wallet
    setPositions(prev => [...prev, newPosition]);
    setWalletBalance(prev => prev - totalCost);

    // Log order (you can replace this with actual API call)
    console.log('Buy Order:', newPosition);
    alert(`Buy Order Placed!\n\nSymbol: ${symbol}\nType: ${type}\nPrice: ₹${price}\nQuantity: ${buyQuantity}\nTotal: ₹${(price * buyQuantity).toFixed(2)}`);
  };

  // Handle exit position (Market)
  const handleExitPosition = (positionId) => {
    const position = positions.find(p => p.id === positionId);
    if (position && window.confirm(`Exit position (Market) for ${position.symbol}?`)) {
      const currentPrice = getCurrentPrice(position.symbol);
      const proceeds = currentPrice * position.quantity;
      const pnl = (currentPrice - position.buyPrice) * position.quantity;

      setPositions(prev => prev.filter(p => p.id !== positionId));
      setWalletBalance(prev => prev + proceeds);

      console.log('Position Exited (Market):', position);
      alert(`Position Exited (Market)!\n\nSymbol: ${position.symbol}\nExit Price: ₹${currentPrice.toFixed(2)}\nProceeds: ₹${proceeds.toFixed(2)}\nP&L: ₹${pnl.toFixed(2)}\n\nNew Balance: ₹${(walletBalance + proceeds).toLocaleString('en-IN')}`);
    }
  };

  // Handle Limit Exit Modal
  const handleOpenLimitModal = (positionId) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      setLimitOrderModal({
        show: true,
        positionId,
        target: position.targetPrice || '',
        sl: position.stopLossPrice || ''
      });
    }
  };

  const handleSaveLimitOrder = () => {
    const { positionId, target, sl } = limitOrderModal;
    setPositions(prev => prev.map(pos => {
      if (pos.id === positionId) {
        return {
          ...pos,
          targetPrice: target ? parseFloat(target) : null,
          stopLossPrice: sl ? parseFloat(sl) : null
        };
      }
      return pos;
    }));
    setLimitOrderModal({ show: false, positionId: null, target: '', sl: '' });
  };

  // Get current price for a position
  const getCurrentPrice = (symbol) => {
    if (!data?.data || !symbol) return 0;

    // Find the option data by symbol
    const optionData = data.data[symbol];
    if (optionData) {
      return optionData.last_price || 0;
    }

    // If direct lookup fails, search through all symbols
    for (const [key, value] of Object.entries(data.data)) {
      if (key === symbol || value.symbol === symbol) {
        return value.last_price || 0;
      }
    }

    return 0;
  };

  // Calculate P&L for a position
  const calculatePnL = (position) => {
    const currentPrice = getCurrentPrice(position.symbol);
    const pnl = (currentPrice - position.buyPrice) * position.quantity;
    return pnl;
  };

  // Calculate total P&L
  const calculateTotalPnL = () => {
    return positions.reduce((total, position) => total + calculatePnL(position), 0);
  };

  // Handle quantity change
  const handleQuantityChange = (e) => {
    setBuyQuantityInput(e.target.value);
  };

  const handleQuantityBlur = () => {
    const value = parseInt(buyQuantityInput) || 65;
    // Round to nearest multiple of 65
    const rounded = Math.max(65, Math.round(value / 65) * 65);
    setBuyQuantity(rounded);
    setBuyQuantityInput(rounded.toString());
  };

  // Sort table
  const handleSort = (key, type) => {
    let direction = 'asc';
    if (sortConfig.key === `${type}-${key}` && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: `${type}-${key}`, direction });
  };

  const getSortedData = () => {
    const optionData = getOptionsByStrike();
    if (!sortConfig.key) return optionData;

    const [type, key] = sortConfig.key.split('-');
    return [...optionData].sort((a, b) => {
      const aVal = type === 'call' ? a.call?.[key] : a.put?.[key];
      const bVal = type === 'call' ? b.call?.[key] : b.put?.[key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading Option Chain Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  const pcr = calculatePCR();
  const maxPain = calculateMaxPain();
  const sentiment = pcr.oiPCR > 1.2 ? 'Bullish' : pcr.oiPCR < 0.8 ? 'Bearish' : 'Neutral';

  return (
    <div className="option-chain-container">
      <style jsx>{`
        .option-chain-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
          color: #fff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 20px;
        }

        .header {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 25px;
        }

        .title {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .last-update {
          font-size: 0.9rem;
          color: #a0aec0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pulse {
          width: 8px;
          height: 8px;
          background: #48bb78;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.08);
          padding: 20px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .metric-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
        }

        .metric-label {
          font-size: 0.85rem;
          color: #a0aec0;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
        }

        .metric-value.spot {
          color: #4299e1;
        }

        .metric-value.atm {
          color: #ed8936;
        }

        .metric-value.bullish {
          color: #48bb78;
        }

        .metric-value.bearish {
          color: #f56565;
        }

        .metric-value.neutral {
          color: #ecc94b;
        }

        .user-info-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          padding: 10px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 20px;
          font-size: 0.8rem;
          color: #a0aec0;
          flex-wrap: wrap;
          gap: 10px;
        }

        .user-info-item {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .user-info-value {
          color: #fff;
          font-weight: 600;
        }

        .user-info-value.profit { color: #48bb78; }
        .user-info-value.loss { color: #f56565; }

        .analysis-section {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 25px;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 20px;
          color: #e2e8f0;
        }

        .table-container {
          overflow-x: auto;
          border-radius: 15px;
          background: rgba(0, 0, 0, 0.2);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1200px;
        }

        th {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px 10px;
          text-align: center;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background 0.3s ease;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        th:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        td {
          padding: 12px 10px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.9rem;
        }

        tr:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .strike-cell {
          font-weight: 700;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.08);
          position: sticky;
          left: 0;
          z-index: 5;
        }

        .strike-cell.atm {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: #fff;
        }

        .itm {
          background: rgba(72, 187, 120, 0.1);
        }

        .otm {
          background: rgba(245, 101, 101, 0.1);
        }

        .positive {
          color: #48bb78;
        }

        .negative {
          color: #f56565;
        }

        .depth-container {
          display: flex;
          gap: 5px;
          justify-content: center;
          font-size: 0.75rem;
        }

        .bid {
          color: #48bb78;
        }

        .ask {
          color: #f56565;
        }

        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
          color: #fff;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          border: none;
          padding: 12px 30px;
          border-radius: 25px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          margin-top: 20px;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .buy-btn {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 0.85rem;
          margin: 0;
          transition: all 0.3s ease;
        }

        .buy-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
        }

        .buy-btn:disabled {
          background: rgba(255, 255, 255, 0.1);
          cursor: not-allowed;
          opacity: 0.5;
        }

        .exit-btn {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          margin: 2px;
          transition: all 0.3s ease;
          color: #fff;
          border: none;
          cursor: pointer;
          font-weight: 600;
        }

        .exit-btn.limit {
          background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
        }

        .exit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.4);
        }

        .exit-btn.limit:hover {
          box-shadow: 0 4px 12px rgba(237, 137, 54, 0.4);
        }

        .quantity-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 12px;
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          transition: all 0.3s ease;
        }

        .quantity-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .quantity-input::-webkit-inner-spin-button,
        .quantity-input::-webkit-outer-spin-button {
          opacity: 1;
        }

        .oi-chart {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .oi-bar {
          background: rgba(255, 255, 255, 0.05);
          padding: 15px;
          border-radius: 10px;
          text-align: center;
        }

        .oi-bar-fill {
          height: 8px;
          border-radius: 4px;
          margin-top: 10px;
          transition: width 0.5s ease;
        }

        .oi-bar-fill.call {
          background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
        }

        .oi-bar-fill.put {
          background: linear-gradient(90deg, #f56565 0%, #e53e3e 100%);
        }

        @media (max-width: 768px) {
          .title {
            font-size: 1.8rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr 1fr;
          }

          .metric-value {
            font-size: 1.5rem;
          }

          .user-info-bar {
            flex-direction: column;
            align-items: flex-start;
          }

          table {
            font-size: 0.75rem;
          }

          th, td {
            padding: 8px 5px;
          }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 40px;
          border-radius: 20px;
          text-align: center;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .user-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 15px;
          color: #fff;
          font-size: 1.2rem;
          margin: 20px 0;
          text-align: center;
        }

        .start-btn {
          width: 100%;
          margin-top: 10px;
        }

        .wallet-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .wallet-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
        }

        .wallet-label {
          color: #a0aec0;
          font-size: 0.9rem;
          margin-bottom: 10px;
        }

        .wallet-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .wallet-value.profit { color: #48bb78; }
        .wallet-value.loss { color: #f56565; }

        .limit-info {
          font-size: 0.75rem;
          color: #a0aec0;
          margin-top: 4px;
        }

        .target-text { color: #48bb78; }
        .sl-text { color: #f56565; }

        .modal-inputs {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin: 20px 0;
        }

        .input-group {
          text-align: left;
        }

        .input-group label {
          display: block;
          font-size: 0.85rem;
          color: #a0aec0;
          margin-bottom: 5px;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
        }

        .modal-actions button {
          flex: 1;
          margin: 0;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>

      {/* User Setup Modal */}
      {showUserSetup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Welcome to Option Trading</h2>
            <p>Create your User ID to start trading</p>
            <input
              type="text"
              placeholder="Enter User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="user-input"
            />
            <p style={{ fontSize: '0.9rem', color: '#a0aec0', marginTop: 10 }}>
              Starting Balance: ₹10,00,000
            </p>
            <button
              className="start-btn"
              onClick={() => {
                if (userId.trim()) {
                  setShowUserSetup(false);
                } else {
                  alert('Please enter a User ID');
                }
              }}
            >
              Start Trading
            </button>
          </div>
        </div>
      )}

      <div className="header">
        <div className="header-top">
          <h1 className="title">NIFTY Option Chain Analysis</h1>
          <div className="last-update">
            <span className="pulse"></span>
            Last Updated: {lastUpdate?.toLocaleTimeString()}
          </div>
        </div>

        {/* User Info Bar */}
        {!showUserSetup && (
          <div className="user-info-bar">
            <div className="user-info-item">
              <span>User ID:</span>
              <span className="user-info-value">{userId}</span>
            </div>
            <div className="user-info-item">
              <span>Wallet:</span>
              <span className="user-info-value">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="user-info-item">
              <span>Net Profit:</span>
              <span className={`user-info-value ${calculateTotalPnL() >= 0 ? 'profit' : 'loss'}`}>
                ₹{calculateTotalPnL().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Spot Price</div>
            <div className="metric-value spot">₹{formatNumber(data?.spot)}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">ATM Strike</div>
            <div className="metric-value atm">{formatNumber(data?.atm)}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">PCR (OI)</div>
            <div className={`metric-value ${sentiment.toLowerCase()}`}>{pcr.oiPCR}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">PCR (Volume)</div>
            <div className={`metric-value ${sentiment.toLowerCase()}`}>{pcr.volumePCR}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Market Sentiment</div>
            <div className={`metric-value ${sentiment.toLowerCase()}`}>{sentiment}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Buy Quantity</div>
            <input
              type="number"
              className="quantity-input"
              value={buyQuantityInput}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              step="65"
              min="65"
            />
            <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '5px' }}>
              (Multiples of 65)
            </div>
          </div>
        </div>
      </div>

      <div className="analysis-section">
        <h2 className="section-title">Option Chain</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th colSpan="6" style={{ background: 'rgba(72, 187, 120, 0.2)' }}>CALLS</th>
                <th rowSpan="2" className="strike-cell">STRIKE</th>
                <th colSpan="6" style={{ background: 'rgba(245, 101, 101, 0.2)' }}>PUTS</th>
              </tr>
              <tr>
                <th onClick={() => handleSort('oi', 'call')}>OI</th>
                <th onClick={() => handleSort('net_change', 'call')}>Change</th>
                <th>Bid</th>
                <th>Ask</th>
                <th onClick={() => handleSort('last_price', 'call')}>LTP</th>
                <th>Buy</th>

                <th>Buy</th>
                <th onClick={() => handleSort('last_price', 'put')}>LTP</th>
                <th>Bid</th>
                <th>Ask</th>
                <th onClick={() => handleSort('net_change', 'put')}>Change</th>
                <th onClick={() => handleSort('oi', 'put')}>OI</th>
              </tr>
            </thead>
            <tbody>
              {getSortedData().map(({ strike, call, put, callSymbol, putSymbol, isATM }) => (
                <tr key={strike}>
                  <td className={getMoneyness(strike, 'CE')}>{formatNumber(call?.oi)}</td>
                  <td className={`${getMoneyness(strike, 'CE')} ${call?.net_change >= 0 ? 'positive' : 'negative'}`}>
                    {call?.net_change?.toFixed(2)}
                  </td>
                  <td className={`${getMoneyness(strike, 'CE')} bid`}>
                    {call?.depth?.buy?.[0]?.price?.toFixed(2)}
                  </td>
                  <td className={`${getMoneyness(strike, 'CE')} ask`}>
                    {call?.depth?.sell?.[0]?.price?.toFixed(2)}
                  </td>
                  <td className={getMoneyness(strike, 'CE')}>{call?.last_price?.toFixed(2)}</td>
                  <td className={getMoneyness(strike, 'CE')}>
                    <button
                      className="buy-btn"
                      onClick={() => handleBuyAtMarket(callSymbol, call?.last_price, 'CE')}
                      disabled={!call?.last_price}
                    >
                      Buy
                    </button>
                  </td>

                  <td className={`strike-cell ${isATM ? 'atm' : ''}`}>{strike}</td>

                  <td className={getMoneyness(strike, 'PE')}>
                    <button
                      className="buy-btn"
                      onClick={() => handleBuyAtMarket(putSymbol, put?.last_price, 'PE')}
                      disabled={!put?.last_price}
                    >
                      Buy
                    </button>
                  </td>
                  <td className={getMoneyness(strike, 'PE')}>{put?.last_price?.toFixed(2)}</td>
                  <td className={`${getMoneyness(strike, 'PE')} bid`}>
                    {put?.depth?.buy?.[0]?.price?.toFixed(2)}
                  </td>
                  <td className={`${getMoneyness(strike, 'PE')} ask`}>
                    {put?.depth?.sell?.[0]?.price?.toFixed(2)}
                  </td>
                  <td className={`${getMoneyness(strike, 'PE')} ${put?.net_change >= 0 ? 'positive' : 'negative'}`}>
                    {put?.net_change?.toFixed(2)}
                  </td>
                  <td className={getMoneyness(strike, 'PE')}>{formatNumber(put?.oi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Positions Section */}
      <div className="analysis-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Net Positions</h2>
          <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
            Total P&L: <span className={calculateTotalPnL() >= 0 ? 'positive' : 'negative'}>
              ₹{calculateTotalPnL().toFixed(2)}
            </span>
          </div>
        </div>

        {positions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>
            <p style={{ fontSize: '1.1rem' }}>No open positions</p>
            <p style={{ fontSize: '0.9rem' }}>Click "Buy" on any option to start trading</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Buy Price</th>
                  <th>Current Price</th>
                  <th>P&L</th>
                  <th>P&L %</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(position => {
                  const currentPrice = getCurrentPrice(position.symbol);
                  const pnl = calculatePnL(position);
                  const pnlPercent = position.buyPrice > 0 ? ((currentPrice - position.buyPrice) / position.buyPrice * 100) : 0;

                  return (
                    <tr key={position.id}>
                      <td style={{ fontWeight: 600 }}>{position.symbol}</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          background: position.type === 'CE' ? 'rgba(72, 187, 120, 0.2)' : 'rgba(245, 101, 101, 0.2)',
                          color: position.type === 'CE' ? '#48bb78' : '#f56565',
                          fontWeight: 600
                        }}>
                          {position.type}
                        </span>
                      </td>
                      <td>{position.quantity}</td>
                      <td>₹{position.buyPrice.toFixed(2)}</td>
                      <td>₹{currentPrice.toFixed(2)}</td>
                      <td className={pnl >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>
                        ₹{pnl.toFixed(2)}
                      </td>
                      <td className={pnlPercent >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>
                        {pnlPercent.toFixed(2)}%
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            className="exit-btn"
                            onClick={() => handleExitPosition(position.id)}
                          >
                            Exit Market
                          </button>
                          <button
                            className="exit-btn limit"
                            onClick={() => handleOpenLimitModal(position.id)}
                          >
                            Exit Limit
                          </button>
                        </div>
                        {(position.targetPrice || position.stopLossPrice) && (
                          <div className="limit-info">
                            {position.targetPrice && <div className="target-text">T: ₹{position.targetPrice.toFixed(2)}</div>}
                            {position.stopLossPrice && <div className="sl-text">SL: ₹{position.stopLossPrice.toFixed(2)}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Limit Order Modal */}
      {limitOrderModal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '10px' }}>Set Limit Order</h2>
            <p style={{ color: '#a0aec0', marginBottom: '20px' }}>
              Position: {positions.find(p => p.id === limitOrderModal.positionId)?.symbol}
            </p>

            <div className="modal-inputs">
              <div className="input-group">
                <label>Target Price (Execution if LTP ≥ Target)</label>
                <input
                  type="number"
                  className="user-input"
                  style={{ margin: 0 }}
                  placeholder="Exit Target Price"
                  value={limitOrderModal.target}
                  onChange={(e) => setLimitOrderModal({ ...limitOrderModal, target: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>Stop Loss Price (Execution if LTP ≤ SL)</label>
                <input
                  type="number"
                  className="user-input"
                  style={{ margin: 0 }}
                  placeholder="Stop Loss Price"
                  value={limitOrderModal.sl}
                  onChange={(e) => setLimitOrderModal({ ...limitOrderModal, sl: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setLimitOrderModal({ ...limitOrderModal, show: false })}>
                Cancel
              </button>
              <button onClick={handleSaveLimitOrder}>
                Apply Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
