import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.UPSTOX_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "UPSTOX_TOKEN missing" });
    }

    const expiryDate = "2026-02-24"; // Change expiry when needed

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // 1️⃣ Fetch NIFTY Spot
    const spotResponse = await fetch(
      "https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    const spotJson = await spotResponse.json();

    const spotPrice =
      spotJson.data?.["NSE_INDEX:Nifty 50"]?.last_price || 0;

    if (!spotPrice) {
      return NextResponse.json({ error: "Unable to fetch spot price" });
    }

    // 2️⃣ Calculate ATM
    const atm = Math.round(spotPrice / 50) * 50;

    // 3️⃣ Create required strikes (5 up & 5 down)
    const requiredStrikes = [];
    for (let i = -9; i <= 9; i++) {
      requiredStrikes.push(atm + i * 50);
    }

    // 4️⃣ Fetch all contracts
    const contractResponse = await fetch(
      "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    const contractData = await contractResponse.json();

    if (!contractData.data) {
      return NextResponse.json({ error: "No contract data received" });
    }

    // 5️⃣ Filter by expiry AND required strikes
    const selectedContracts = contractData.data.filter(
      (c) =>
        c.expiry === expiryDate &&
        requiredStrikes.includes(Number(c.strike_price))
    );

    if (selectedContracts.length === 0) {
      return NextResponse.json({ error: "No matching contracts found" });
    }

    // 6️⃣ Create instrument keys
    const instrumentKeys = selectedContracts
      .map((c) => c.instrument_key)
      .join(",");

    // 7️⃣ Fetch option quotes
    const quoteResponse = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instrumentKeys}`,
      { headers }
    );

    const quoteData = await quoteResponse.json();

    // 8️⃣ Return final response
    return NextResponse.json({
      status: "success",
      spot: spotPrice,
      atm: atm,
      strikes: requiredStrikes,
      data: quoteData.data,
    });

  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error.message,
    });
  }
}
