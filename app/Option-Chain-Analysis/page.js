"use client";

import { useEffect, useState } from "react";

export default function OptionChainAnalysis() {
  const [data, setData] = useState(null);
  const [sortKey, setSortKey] = useState("strike");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/option-chain");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <h2 style={{ padding: 20 }}>Loading...</h2>;

  const { spot, strikes, data: optionData } = data;

  const getOption = (strike, type) => {
    const key = Object.keys(optionData).find(
      (k) => k.includes(strike) && k.endsWith(type)
    );
    return key ? optionData[key] : null;
  };

  // ---------- CALCULATIONS ----------
  let totalCallOI = 0;
  let totalPutOI = 0;

  const rows = strikes.map((strike) => {
    const ce = getOption(strike, "CE");
    const pe = getOption(strike, "PE");

    if (ce) totalCallOI += ce.open_interest || 0;
    if (pe) totalPutOI += pe.open_interest || 0;

    return { strike, ce, pe };
  });

  const PCR = (totalPutOI / totalCallOI).toFixed(2);

  // ---------- SORTING ----------
  const sortedRows = [...rows].sort((a, b) => {
    if (sortKey === "strike") {
      return sortAsc ? a.strike - b.strike : b.strike - a.strike;
    }

    const aVal = a.ce?.[sortKey] || 0;
    const bVal = b.ce?.[sortKey] || 0;

    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const sortColumn = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  // ---------- BUILD-UP DETECTION ----------
  const detectBuildUp = (opt) => {
    if (!opt) return "-";

    const priceUp = opt.price_change > 0;
    const oiUp = opt.oi_change > 0;

    if (priceUp && oiUp) return "Long Build-up";
    if (!priceUp && oiUp) return "Short Build-up";
    if (priceUp && !oiUp) return "Short Covering";
    if (!priceUp && !oiUp) return "Long Unwinding";

    return "-";
  };

  // ---------- HEATMAP ----------
  const getHeatColor = (value, max) => {
    if (!value) return "white";
    const intensity = value / max;
    return `rgba(255,0,0,${intensity})`;
  };

  const maxOI = Math.max(
    ...rows.map((r) => r.ce?.open_interest || 0)
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>NIFTY Advanced Option Chain</h1>

      <h2>Spot: {spot}</h2>
      <h3>PCR: {PCR}</h3>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th onClick={() => sortColumn("last_price")}>CE LTP</th>
            <th onClick={() => sortColumn("open_interest")}>CE OI</th>
            <th>CE OI Chg</th>
            <th>CE Build-up</th>

            <th>Strike</th>

            <th>PE Build-up</th>
            <th>PE OI Chg</th>
            <th>PE OI</th>
            <th>PE LTP</th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map(({ strike, ce, pe }) => {
            const isCallITM = strike < spot;
            const isPutITM = strike > spot;

            return (
              <tr key={strike}>
                <td
                  style={{
                    background: isCallITM ? "#d4f4ff" : "white",
                  }}
                >
                  {ce?.last_price ?? "-"}
                </td>

                <td
                  style={{
                    background: getHeatColor(
                      ce?.open_interest,
                      maxOI
                    ),
                  }}
                >
                  {ce?.open_interest ?? "-"}
                </td>

                <td>{ce?.oi_change ?? "-"}</td>
                <td>{detectBuildUp(ce)}</td>

                <td
                  style={{
                    fontWeight:
                      Math.abs(strike - spot) < 50
                        ? "bold"
                        : "normal",
                  }}
                >
                  {strike}
                </td>

                <td>{detectBuildUp(pe)}</td>
                <td>{pe?.oi_change ?? "-"}</td>

                <td
                  style={{
                    background: getHeatColor(
                      pe?.open_interest,
                      maxOI
                    ),
                  }}
                >
                  {pe?.open_interest ?? "-"}
                </td>

                <td
                  style={{
                    background: isPutITM ? "#ffd6d6" : "white",
                  }}
                >
                  {pe?.last_price ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
