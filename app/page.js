"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const lotSize = 65;

  const [spot, setSpot] = useState("--");
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [positions, setPositions] = useState([]);

  // ---------------- LOAD MARKET ----------------
  async function loadMarket() {
    try {
      const res = await fetch("/api/option-chain");
      const json = await res.json();

      if (!json.data) return;

      setSpot(json.spot);

      const strikes = json.strikes;
      const data = json.data;

      const formatted = strikes.map((strike) => {
        const ceKey = Object.keys(data).find(
          (k) => k.includes(strike) && k.endsWith("CE")
        );
        const peKey = Object.keys(data).find(
          (k) => k.includes(strike) && k.endsWith("PE")
        );

        return {
          strike,
          ce: ceKey ? data[ceKey] : null,
          pe: peKey ? data[peKey] : null,
        };
      });

      setRows(formatted);
    } catch (err) {
      console.log(err);
    }
  }

  // ---------------- LOGIN ----------------
  function handleLogin() {
    const name = prompt("Enter your name");
    if (!name) return;

    const newUser = { name };

    localStorage.setItem("user", JSON.stringify(newUser));
    localStorage.setItem("wallet", 1000000);
    localStorage.setItem("positions", JSON.stringify([]));

    setUser(newUser);
    setWallet(100000);
    setPositions([]);
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  // ---------------- BUY ----------------
  function buyOption(strike, type, price) {
    const qtyInput = prompt("Enter lots (1 lot = 65 qty):");
    if (!qtyInput) return;

    const lots = Number(qtyInput);
    if (isNaN(lots) || lots <= 0) {
      alert("Invalid lots");
      return;
    }

    const qty = lots * lotSize;
    const cost = qty * price;

    if (wallet < cost) {
      alert("Insufficient Balance");
      return;
    }

    const newWallet = wallet - cost;

    const newPosition = {
      strike,
      type,
      qty,
      buyPrice: price,
    };

    const updatedPositions = [...positions, newPosition];

    setWallet(newWallet);
    setPositions(updatedPositions);

    localStorage.setItem("wallet", newWallet);
    localStorage.setItem("positions", JSON.stringify(updatedPositions));
  }

  // ---------------- EXIT ----------------
  function exitPosition(index, currentPrice) {
    const position = positions[index];

    const exitValue = position.qty * currentPrice;
    const newWallet = wallet + exitValue;

    const updatedPositions = positions.filter(
      (_, i) => i !== index
    );

    setWallet(newWallet);
    setPositions(updatedPositions);

    localStorage.setItem("wallet", newWallet);
    localStorage.setItem("positions", JSON.stringify(updatedPositions));
  }

  // ---------------- LOAD LOCAL STORAGE ----------------
  useEffect(() => {
    loadMarket();
    const interval = setInterval(loadMarket, 3000);

    const storedUser = localStorage.getItem("user");
    const storedWallet = localStorage.getItem("wallet");
    const storedPositions = localStorage.getItem("positions");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setWallet(Number(storedWallet));
      setPositions(JSON.parse(storedPositions));
    }

    return () => clearInterval(interval);
  }, []);

  // ---------------- TOTAL MTM ----------------
  const totalMTM = positions.reduce((total, pos) => {
    const row = rows.find((r) => r.strike === pos.strike);

    const currentPrice =
      pos.type === "CE"
        ? row?.ce?.last_price
        : row?.pe?.last_price;

    if (!currentPrice) return total;

    return total + (currentPrice - pos.buyPrice) * pos.qty;
  }, 0);

  // ---------------- LOGIN SCREEN ----------------
  if (!user) {
    return (
      <div style={styles.center}>
        <h2>Paper Trading Login</h2>
        <button style={styles.button} onClick={handleLogin}>
          Start Trading
        </button>
      </div>
    );
  }

  // ---------------- MAIN UI ----------------
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2>Welcome {user.name}</h2>
          <div>Spot: <b>{spot}</b></div>
          <div>
            Wallet: ₹ <b>{wallet.toFixed(2)}</b>
          </div>
          <div>
            Total MTM:{" "}
            <b style={{ color: totalMTM >= 0 ? "lime" : "red" }}>
              {totalMTM.toFixed(2)}
            </b>
          </div>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      {/* OPTION CHAIN */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th>CE LTP</th>
            <th>Strike</th>
            <th>PE LTP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                {row.ce?.last_price ?? "-"}
                {row.ce && (
                  <button
                    style={styles.buyBtn}
                    onClick={() =>
                      buyOption(
                        row.strike,
                        "CE",
                        row.ce.last_price
                      )
                    }
                  >
                    Buy
                  </button>
                )}
              </td>

              <td style={styles.strike}>{row.strike}</td>

              <td>
                {row.pe?.last_price ?? "-"}
                {row.pe && (
                  <button
                    style={styles.buyBtn}
                    onClick={() =>
                      buyOption(
                        row.strike,
                        "PE",
                        row.pe.last_price
                      )
                    }
                  >
                    Buy
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* POSITIONS */}
      <h3>Your Positions</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Strike</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Buy Price</th>
            <th>Current Price</th>
            <th>Net Profit</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const row = rows.find(
              (r) => r.strike === pos.strike
            );

            const currentPrice =
              pos.type === "CE"
                ? row?.ce?.last_price
                : row?.pe?.last_price;

            const profit =
              currentPrice
                ? (currentPrice - pos.buyPrice) * pos.qty
                : 0;

            return (
              <tr key={i}>
                <td>{pos.strike}</td>
                <td>{pos.type}</td>
                <td>{pos.qty}</td>
                <td>{pos.buyPrice}</td>
                <td>{currentPrice ?? "-"}</td>
                <td
                  style={{
                    color: profit >= 0 ? "lime" : "red",
                    fontWeight: "bold",
                  }}
                >
                  {profit.toFixed(2)}
                </td>
                <td>
                  {currentPrice && (
                    <button
                      style={styles.exitBtn}
                      onClick={() =>
                        exitPosition(i, currentPrice)
                      }
                    >
                      Exit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: {
    background: "#111",
    minHeight: "100vh",
    color: "white",
    padding: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    marginBottom: "20px",
    borderCollapse: "collapse",
  },
  strike: {
    fontWeight: "bold",
    textAlign: "center",
  },
  buyBtn: {
    marginLeft: "5px",
    background: "green",
    color: "white",
    border: "none",
    padding: "4px 6px",
    cursor: "pointer",
  },
  exitBtn: {
    background: "red",
    color: "white",
    border: "none",
    padding: "5px",
    cursor: "pointer",
  },
  center: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
  },
};
