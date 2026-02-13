"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [spot, setSpot] = useState("--");
  const [rows, setRows] = useState([]);

  async function loadData() {
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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Nifty<span style={{ color: "#3b82f6" }}>Trade</span></h1>
        <div>
          Spot: <span style={styles.spot}>{spot}</span>
        </div>
      </header>

      <table style={styles.table}>
        <thead>
          <tr>
            <th colSpan="3" style={{ background: "#1e3a8a" }}>CALLS</th>
            <th>STRIKE</th>
            <th colSpan="3" style={{ background: "#7f1d1d" }}>PUTS</th>
          </tr>
          <tr>
            <th>OI</th>
            <th>Vol</th>
            <th>LTP</th>
            <th></th>
            <th>LTP</th>
            <th>Vol</th>
            <th>OI</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.ce?.oi ?? "-"}</td>
              <td>{row.ce?.volume ?? "-"}</td>
              <td style={styles.ltpCall}>
                {row.ce?.last_price ?? "-"}
              </td>

              <td style={styles.strike}>{row.strike}</td>

              <td style={styles.ltpPut}>
                {row.pe?.last_price ?? "-"}
              </td>
              <td>{row.pe?.volume ?? "-"}</td>
              <td>{row.pe?.oi ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: {
    background: "#0f172a",
    minHeight: "100vh",
    color: "white",
    padding: "20px",
    fontFamily: "Inter, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  spot: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#22c55e",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  strike: {
    background: "#1e293b",
    fontWeight: "bold",
    textAlign: "center",
  },
  ltpCall: {
    color: "#22c55e",
    fontWeight: "bold",
  },
  ltpPut: {
    color: "#ef4444",
    fontWeight: "bold",
  },
};
