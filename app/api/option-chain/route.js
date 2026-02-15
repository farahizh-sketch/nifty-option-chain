import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.UPSTOX_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "UPSTOX_TOKEN missing" }, { status: 500 });
    }

    const expiryDates = "2026-02-17"; // Add/remove expiry dates here

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // 1️⃣ Fetch NIFTY Spot
    const spotResponse = await fetch(
      "https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    if (!spotResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch spot price" }, { status: 500 });
    }

    const spotJson = await spotResponse.json();

    const spotPrice =
      spotJson.data?.["NSE_INDEX:Nifty 50"]?.last_price ?? 0;

    if (!spotPrice) {
      return NextResponse.json({ error: "Unable to fetch spot price" }, { status: 500 });
    }

    // 2️⃣ Calculate ATM
    const atm = Math.round(spotPrice / 50) * 50;

    // 3️⃣ Create required strikes (9 up & 9 down + ATM)
    const requiredStrikes: number[] = [];
    for (let i = -9; i <= 9; i++) {
      requiredStrikes.push(atm + i * 50);
    }

    // 4️⃣ Fetch all contracts
    const contractResponse = await fetch(
      "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    if (!contractResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 });
    }

    const contractData = await contractResponse.json();

    if (!contractData.data) {
      return NextResponse.json({ error: "No contract data received" }, { status: 500 });
    }

    // 5️⃣ Filter by expiry dates AND required strikes
    const selectedContracts = contractData.data.filter(
      (c: any) =>
        expiryDates.includes(c.expiry) &&
        requiredStrikes.includes(Number(c.strike_price))
    );

    if (selectedContracts.length === 0) {
      return NextResponse.json({ error: "No matching contracts found" }, { status: 404 });
    }

    // 6️⃣ Create instrument keys
    const instrumentKeys = selectedContracts
      .map((c: any) => c.instrument_key)
      .join(",");

    // 7️⃣ Fetch option quotes
    const quoteResponse = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instrumentKeys}`,
      { headers }
    );

    if (!quoteResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch option quotes" }, { status: 500 });
    }

    const quoteData = await quoteResponse.json();

    // 8️⃣ Return final response
    return NextResponse.json({
      status: "success",
      spot: spotPrice,
      atm,
      strikes: requiredStrikes,
      expiryDates,
      data: quoteData.data,
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Unexpected error",
      },
      { status: 500 }
    );
  }
}
