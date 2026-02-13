import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.UPSTOX_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "UPSTOX_TOKEN missing" });
    }

    const expiryDate = "2026-02-17"; // change expiry if needed

    // 1️⃣ Get all NIFTY option contracts
    const contractResponse = await fetch(
      "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty 50",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const contractData = await contractResponse.json();

    if (!contractData.data) {
      return NextResponse.json({ error: "No contract data received" });
    }

    // 2️⃣ Filter contracts by expiry
    const filteredContracts = contractData.data.filter(
      (c) => c.expiry === expiryDate
    );

    if (filteredContracts.length === 0) {
      return NextResponse.json({ error: "No contracts for this expiry" });
    }

    // 3️⃣ Take limited contracts (to avoid URL too long error)
    const instrumentKeys = filteredContracts
      .slice(0, 40)
      .map((c) => c.instrument_key)
      .join(",");

    // 4️⃣ Fetch option quotes
    const quoteResponse = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instrumentKeys}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const quoteData = await quoteResponse.json();

    // 5️⃣ Fetch NIFTY SPOT
    const spotResponse = await fetch(
      "https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty 50",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const spotJson = await spotResponse.json();

    const spotPrice =
      spotJson.data?.["NSE_INDEX:Nifty 50"]?.last_price || 0;

    // 6️⃣ Return everything
    return NextResponse.json({
      status: "success",
      spot: spotPrice,
      data: quoteData.data,
    });

  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error.message,
    });
  }
}
