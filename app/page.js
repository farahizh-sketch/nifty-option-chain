"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [rows, setRows] = useState([]);
  const [spot, setSpot] = useState(0);

  useEffect(() => {
    async function loadData() {
      const res = await fetch("/api/option-chain");
      const json = await res.json();

      if (!json.data) return;

      setSpot(json.spot);

      const grouped = {};

      Object.keys(json.data).forEach((key) => {
        const item = json.data[key];

        const strikeMatch = key.match(/(\d{5})(CE|PE)$/);
        if (!strikeMatch) return;

        const strike = Number(strikeMatch[1]);
        const type = strikeMatch[2];

        if (!grouped[strike]) {
          grouped[strike] = { CE: "-", PE: "-" };
        }

        grouped[strike][type] = item.last_price;
      });

      // Find ATM
      const atm = Math.round(json.spot / 50) * 50;

      // Create 5 up & 5 down
      const selectedStrikes = [];
      for (let i = -9; i <= 9; i++) {
        selectedStrikes.push(atm + i * 50);
      }

      const finalRows = selectedStrikes.map((strike) => ({
        strike,
        CE: grouped[strike]?.CE || "-",
        PE: grouped[strike]?.PE || "-",
      }));

      setRows(finalRows);
    }

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const atmStrike = Math.round(spot / 50) * 50;

  return (
    <div style={{ padding: 20 }}>
      <h1>NIFTY Option Chain</h1>

      <h2>Spot Price: {spot}</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>CE LTP</th>
            <th>Strike</th>
            <th>PE LTP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              style={{
                backgroundColor:
                  row.strike === atmStrike ? "#ffe082" : "white",
              }}
            >
              <td>{row.CE}</td>
              <td>{row.strike}</td>
              <td>{row.PE}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
