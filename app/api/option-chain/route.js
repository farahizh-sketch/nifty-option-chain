import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.UPSTOX_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "UPSTOX_TOKEN missing" },
        { status: 500 }
      );
    }

    // ✅ Target Expiries
    const targetExpiries = ["2026-02-17", "2026-02-24"];

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // 1️⃣ Fetch Spot
    const spotResponse = await fetch(
      "https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    const spotJson = await spotResponse.json();

    const spotPrice =
      spotJson.data?.["NSE_INDEX:Nifty 50"]?.last_price ?? 0;

    if (!spotPrice) {
      return NextResponse.json(
        { error: "Unable to fetch spot price" },
        { status: 500 }
      );
    }

    const atm = Math.round(spotPrice / 50) * 50;

    // 2️⃣ Required Strikes
    const requiredStrikes: number[] = [];
    for (let i = -9; i <= 9; i++) {
      requiredStrikes.push(atm + i * 50);
    }

    // 3️⃣ Fetch Contracts
    const contractResponse = await fetch(
      "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty 50",
      { headers }
    );

    const contractData = await contractResponse.json();

    if (!contractData.data) {
      return NextResponse.json(
        { error: "No contract data received" },
        { status: 500 }
      );
    }

    // 🟢 DEBUG: See all available expiries from Upstox
    const availableExpiries = [
      ...new Set(contractData.data.map((c: any) => c.expiry)),
    ];

    console.log("Available Expiries from Upstox:", availableExpiries);

    // 4️⃣ Filter by expiry + strike
    const selectedContracts = contractData.data.filter((c: any) => {
      const contractExpiry = String(c.expiry).trim();

      return (
        targetExpiries.includes(contractExpiry) &&
        requiredStrikes.includes(Number(c.strike_price))
      );
    });

    if (selectedContracts.length === 0) {
      return NextResponse.json(
        {
          error: "No matching contracts found",
          availableExpiries,
        },
        { status: 404 }
      );
    }

    // 5️⃣ Fetch Quotes
    const instrumentKeys = selectedContracts
      .map((c: any) => c.instrument_key)
      .join(",");

    const quoteResponse = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${instrumentKeys}`,
      { headers }
    );

    const quoteData = await quoteResponse.json();

    return NextResponse.json({
      status: "success",
      spot: spotPrice,
      atm,
      requestedExpiries: targetExpiries,
      availableExpiries,
      strikes: requiredStrikes,
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
