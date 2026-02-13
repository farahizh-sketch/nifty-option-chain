"use client"; // needed for client-side JS like fetch

import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState({});

  useEffect(() => {
    async function loadData() {
      const res = await fetch("/api/option-chain");
      const json = await res.json();
      setData(json.data);
    }

    loadData();
    const interval = setInterval(loadData, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>NIFTY Option Chain</h2>
      <table border="1">
        <thead>
          <tr>
            <th>CE LTP</th>
            <th>Strike</th>
            <th>PE LTP</th>
          </tr>
        </thead>
        <tbody>
          {data &&
            Object.keys(data).sort().map((symbol) => {
              const item = data[symbol];
              const ce = item["CE"]?.last_price || "-";
              const pe = item["PE"]?.last_price || "-";
              const strike = symbol.match(/\d+/)[0];
              return (
                <tr key={symbol}>
                  <td>{ce}</td>
                  <td>{strike}</td>
                  <td>{pe}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
