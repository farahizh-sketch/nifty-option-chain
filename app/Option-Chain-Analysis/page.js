"use client";

import { useEffect, useState } from "react";

export default function OptionChainAnalysis() {
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/option-chain");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 20000); // refresh every 10 sec

    return () => clearInterval(interval);
  }, []);

  if (!data) return <h2 style={{ padding: 20 }}>Loading...</h2>;

  const { spot, strikes, data: optionData } = data;

  const getLTP = (strike, type) => {
    const key = Object.keys(optionData).find((k) =>
      k.includes(strike) && k.endsWith(type)
    );
    return key ? optionData[key].last_price : "-";
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>NIFTY Option Chain Analysis</h1>
      <h2>Spot Price: {spot}</h2>

      <table border="1" cellPadding="8" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>CE LTP</th>
            <th>Strike</th>
            <th>PE LTP</th>
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike) => (
            <tr key={strike}>
              <td>{getLTP(strike, "CE")}</td>
              <td>{strike}</td>
              <td>{getLTP(strike, "PE")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
