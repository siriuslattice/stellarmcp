/**
 * StellarMCP — SMA Crossover Trading Strategy Example
 *
 * Demonstrates how an AI agent (or any developer) can consume the
 * `getPriceHistory` tool from StellarMCP to implement a Simple Moving
 * Average (SMA) crossover strategy on Stellar SDEX data.
 *
 * Strategy:
 *   - Fast SMA (default 5 periods) over closing prices
 *   - Slow SMA (default 20 periods) over closing prices
 *   - BULLISH crossover: fast crosses above slow → BUY signal
 *   - BEARISH crossover: fast crosses below slow → SELL signal
 *
 * Usage:
 *   1. Start the StellarMCP HTTP server:     TRANSPORT=http pnpm start
 *   2. Run this example:                     tsx examples/trading-strategy-sma.ts
 *
 * Environment variables (all optional):
 *   STELLARMCP_URL      default: http://localhost:4021
 *   SMA_BASE_ASSET      default: XLM
 *   SMA_COUNTER_ASSET   default: USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *   SMA_FAST_PERIOD     default: 5
 *   SMA_SLOW_PERIOD     default: 20
 *   SMA_RESOLUTION      default: 1h   (1m, 5m, 15m, 1h, 1d, 1w)
 *   SMA_LIMIT           default: 30
 *
 * Note: All output goes to stderr so this example can be piped/composed
 * with MCP tools that use stdout for JSON-RPC transport.
 */

import "dotenv/config";

const STELLARMCP_URL = process.env.STELLARMCP_URL || "http://localhost:4021";
const BASE_ASSET = process.env.SMA_BASE_ASSET || "XLM";
const COUNTER_ASSET =
  process.env.SMA_COUNTER_ASSET ||
  "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const FAST_PERIOD = parseInt(process.env.SMA_FAST_PERIOD || "5", 10);
const SLOW_PERIOD = parseInt(process.env.SMA_SLOW_PERIOD || "20", 10);
const RESOLUTION = process.env.SMA_RESOLUTION || "1h";
const LIMIT = parseInt(process.env.SMA_LIMIT || "30", 10);

interface Candle {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: string;
}

interface PriceHistoryResponse {
  candles: Candle[];
}

interface CrossoverSignal {
  timestamp: string;
  type: "BULLISH" | "BEARISH";
  fastSma: number;
  slowSma: number;
  closePrice: number;
}

/**
 * Compute the Simple Moving Average of `closes` over `period` candles,
 * ending at index `atIndex` (inclusive). Returns null if there isn't
 * enough data yet.
 */
function computeSMA(
  closes: number[],
  period: number,
  atIndex: number,
): number | null {
  if (atIndex < period - 1) return null;
  let sum = 0;
  for (let i = atIndex - period + 1; i <= atIndex; i++) {
    sum += closes[i];
  }
  return sum / period;
}

/**
 * Walk candles in chronological order, tracking prior fast/slow SMA
 * values, and emit a signal every time the fast SMA crosses the slow.
 */
function detectCrossovers(
  candles: Candle[],
  fastPeriod: number,
  slowPeriod: number,
): CrossoverSignal[] {
  const closes = candles.map((c) => parseFloat(c.close));
  const signals: CrossoverSignal[] = [];

  let prevFast: number | null = null;
  let prevSlow: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    const fast = computeSMA(closes, fastPeriod, i);
    const slow = computeSMA(closes, slowPeriod, i);
    if (fast === null || slow === null) {
      prevFast = fast;
      prevSlow = slow;
      continue;
    }

    if (prevFast !== null && prevSlow !== null) {
      // Bullish crossover: fast was below (or equal to) slow, now above.
      if (prevFast <= prevSlow && fast > slow) {
        signals.push({
          timestamp: candles[i].timestamp,
          type: "BULLISH",
          fastSma: fast,
          slowSma: slow,
          closePrice: closes[i],
        });
      }
      // Bearish crossover: fast was above (or equal to) slow, now below.
      if (prevFast >= prevSlow && fast < slow) {
        signals.push({
          timestamp: candles[i].timestamp,
          type: "BEARISH",
          fastSma: fast,
          slowSma: slow,
          closePrice: closes[i],
        });
      }
    }

    prevFast = fast;
    prevSlow = slow;
  }

  return signals;
}

/**
 * Fetch OHLC candles from the StellarMCP REST endpoint.
 * Uses plain HTTP — for a paid/x402 variant, see scripts/x402-client.ts.
 */
async function fetchPriceHistory(): Promise<Candle[]> {
  const url = new URL(`${STELLARMCP_URL}/tools/getPriceHistory`);
  url.searchParams.set("baseAsset", BASE_ASSET);
  url.searchParams.set("counterAsset", COUNTER_ASSET);
  url.searchParams.set("resolution", RESOLUTION);
  url.searchParams.set("limit", String(LIMIT));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as PriceHistoryResponse;
  if (!data.candles || data.candles.length === 0) {
    throw new Error(
      "No candles returned — check server is running and asset pair has trade data",
    );
  }
  // Horizon returns candles in descending (newest-first) order.
  // Reverse so indices flow chronologically (oldest → newest).
  return data.candles.slice().reverse();
}

async function main() {
  console.error("=".repeat(60));
  console.error("  StellarMCP — SMA Crossover Strategy Example");
  console.error("=".repeat(60));
  console.error(`  Pair:       ${BASE_ASSET} / ${COUNTER_ASSET.slice(0, 30)}...`);
  console.error(`  Resolution: ${RESOLUTION}`);
  console.error(`  Candles:    ${LIMIT}`);
  console.error(`  Fast SMA:   ${FAST_PERIOD} periods`);
  console.error(`  Slow SMA:   ${SLOW_PERIOD} periods`);
  console.error("");

  const candles = await fetchPriceHistory();
  console.error(`  Fetched ${candles.length} candles`);
  console.error("");

  const signals = detectCrossovers(candles, FAST_PERIOD, SLOW_PERIOD);

  if (signals.length === 0) {
    console.error("  No crossover signals detected in this window.");
  } else {
    console.error(`  ${signals.length} crossover signal(s) detected:`);
    console.error("");
    for (const s of signals) {
      const arrow = s.type === "BULLISH" ? "▲ BUY " : "▼ SELL";
      console.error(
        `    ${arrow}  ${s.timestamp}  fast=${s.fastSma.toFixed(7)}  slow=${s.slowSma.toFixed(7)}  close=${s.closePrice.toFixed(7)}`,
      );
    }
  }

  // Current trend — compare the most recent fast vs slow SMA.
  const closes = candles.map((c) => parseFloat(c.close));
  const finalFast = computeSMA(closes, FAST_PERIOD, closes.length - 1);
  const finalSlow = computeSMA(closes, SLOW_PERIOD, closes.length - 1);
  console.error("");
  if (finalFast !== null && finalSlow !== null) {
    const trend =
      finalFast > finalSlow
        ? "BULLISH"
        : finalFast < finalSlow
          ? "BEARISH"
          : "NEUTRAL";
    console.error(`  Current trend: ${trend}`);
    console.error(`    Fast SMA (${FAST_PERIOD}): ${finalFast.toFixed(7)}`);
    console.error(`    Slow SMA (${SLOW_PERIOD}): ${finalSlow.toFixed(7)}`);
  } else {
    console.error(
      "  Insufficient data for trend (need at least slowPeriod candles)",
    );
  }

  const latestSignal = signals[signals.length - 1];
  if (latestSignal) {
    const action = latestSignal.type === "BULLISH" ? "BUY" : "SELL";
    console.error(`  Latest signal:  ${action} at ${latestSignal.timestamp}`);
  } else {
    console.error("  Latest signal:  HOLD (no crossovers in window)");
  }

  console.error("");
  console.error("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
