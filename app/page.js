"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function loadData() {
      const res = await fetch("/api/option-chain");
      const json = await res.json();

      if (!json.data) return;

      const grouped = {};

      Object.keys(json.data).forEach((key) => {
        const item = json.data[key];

        // Extract strike properly (last 5 digits before CE/PE)
        const strikeMatch = key.match(/(\d{5})(CE|PE)$/);
        if (!strikeMatch) return;

        const strike = strikeMatch[1];
        const type = strikeMatch[2];

        if (!grouped[strike]) {
          grouped[strike] = { CE: "-", PE: "-" };
        }

        grouped[strike][type] = item.last_price;
      });

      const formattedRows = Object.keys(grouped)
        .sort((a, b) => Number(a) - Number(b))
        .map((strike) => ({
          strike,
          CE: grouped[strike].CE,
          PE: grouped[strike].PE,
        }));

      setRows(formattedRows);
    }

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>NIFTY Option Chain</h2>

      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>CE LTP</th>
            <th>Strike</th>
            <th>PE LTP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
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
