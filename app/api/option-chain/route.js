import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.UPSTOX_TOKEN;
    if (!token) return NextResponse.json({ error: "UPSTOX_TOKEN missing" });

    const expiryDate = "2026-02-17";

    // 1️⃣ Get all NIFTY option contracts
    const contractResponse = await fetch(
      "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty 50",
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      }
    );
    const contractData = await contractResponse.json();

    // 2️⃣ Filter for desired expiry
    const filteredContracts = contractData.data.filter(c => c.expiry === expiryDate);

    // 3️⃣ Take first 10 contracts
    const instrumentKeys = filteredContracts
      .slice(0, 10)
      .map(c => c.instrument_key)
      .join(",");

    // 4️⃣ Fetch live quotes
    const quoteResponse = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instrumentKeys}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    const quoteData = await quoteResponse.json();

    return NextResponse.json(quoteData);

  } catch (error) {
    return NextResponse.json({ error: error.message });
  }
}
