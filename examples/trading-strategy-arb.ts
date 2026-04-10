import "dotenv/config";

/**
 * StellarMCP — Cross-pair Arbitrage Detection Example
 *
 * Detects stale orderbook discrepancies between forward and inverse asset pairs
 * on Stellar SDEX. If the midprice of XLM/USDC differs from 1/(USDC/XLM midprice)
 * by more than MIN_SPREAD_BPS basis points, an arb opportunity exists.
 *
 * Usage: pnpm demo:arb (after starting the HTTP server with `pnpm start`)
 */

const STELLARMCP_URL = process.env.STELLARMCP_URL || "http://localhost:4021";
const MIN_SPREAD_BPS = parseInt(process.env.ARB_MIN_SPREAD_BPS || "50", 10); // 0.5% default

// Default asset pairs to scan
const USDC = "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const PAIRS_TO_SCAN: { name: string; base: string; counter: string }[] = [
  { name: "XLM/USDC", base: "XLM", counter: USDC },
];

interface OrderbookEntry {
  price: string;
  amount: string;
}

interface OrderbookResponse {
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
  spread: string | null;
  midPrice: string | null;
}

interface ArbCheck {
  pair: string;
  forwardMid: number | null;
  inverseMid: number | null;
  inverseMidConverted: number | null; // 1 / inverseMid
  divergenceBps: number | null;
  hasOpportunity: boolean;
  forwardSpreadBps: number | null;
  inverseSpreadBps: number | null;
}

async function fetchOrderbook(
  selling: string,
  buying: string,
): Promise<OrderbookResponse> {
  const url = new URL(`${STELLARMCP_URL}/tools/getOrderbook`);
  url.searchParams.set("sellingAsset", selling);
  url.searchParams.set("buyingAsset", buying);
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as OrderbookResponse;
}

function computeSpreadBps(orderbook: OrderbookResponse): number | null {
  if (orderbook.spread === null || orderbook.midPrice === null) return null;
  const spread = parseFloat(orderbook.spread);
  const mid = parseFloat(orderbook.midPrice);
  if (mid === 0) return null;
  return (spread / mid) * 10_000; // basis points
}

async function checkPairArbitrage(
  name: string,
  base: string,
  counter: string,
): Promise<ArbCheck> {
  // Forward orderbook: sell base, buy counter (e.g. sell XLM, buy USDC)
  const forward = await fetchOrderbook(base, counter);
  // Inverse orderbook: sell counter, buy base (e.g. sell USDC, buy XLM)
  const inverse = await fetchOrderbook(counter, base);

  const forwardMid =
    forward.midPrice !== null ? parseFloat(forward.midPrice) : null;
  const inverseMid =
    inverse.midPrice !== null ? parseFloat(inverse.midPrice) : null;

  // Convert inverse to forward terms: 1 / inverseMid
  const inverseMidConverted =
    inverseMid !== null && inverseMid !== 0 ? 1 / inverseMid : null;

  let divergenceBps: number | null = null;
  let hasOpportunity = false;

  if (forwardMid !== null && inverseMidConverted !== null && forwardMid !== 0) {
    const diff = Math.abs(forwardMid - inverseMidConverted);
    divergenceBps = (diff / forwardMid) * 10_000;
    hasOpportunity = divergenceBps > MIN_SPREAD_BPS;
  }

  return {
    pair: name,
    forwardMid,
    inverseMid,
    inverseMidConverted,
    divergenceBps,
    hasOpportunity,
    forwardSpreadBps: computeSpreadBps(forward),
    inverseSpreadBps: computeSpreadBps(inverse),
  };
}

function formatNumber(n: number | null, digits = 7): string {
  return n === null ? "n/a" : n.toFixed(digits);
}

async function main() {
  console.error("=".repeat(70));
  console.error("  StellarMCP — Cross-pair Arbitrage Detection");
  console.error("=".repeat(70));
  console.error(`  Server:          ${STELLARMCP_URL}`);
  console.error(`  Min spread:      ${MIN_SPREAD_BPS} bps`);
  console.error(`  Pairs scanning:  ${PAIRS_TO_SCAN.length}`);
  console.error("");

  const results: ArbCheck[] = [];

  for (const p of PAIRS_TO_SCAN) {
    console.error(`  [${p.name}]`);
    try {
      const check = await checkPairArbitrage(p.name, p.base, p.counter);
      results.push(check);

      console.error(`    Forward mid:           ${formatNumber(check.forwardMid)}`);
      console.error(`    Inverse mid:           ${formatNumber(check.inverseMid)}`);
      console.error(`    Inverse converted:     ${formatNumber(check.inverseMidConverted)}`);
      console.error(`    Forward spread:        ${formatNumber(check.forwardSpreadBps, 2)} bps`);
      console.error(`    Inverse spread:        ${formatNumber(check.inverseSpreadBps, 2)} bps`);
      console.error(`    Divergence:            ${formatNumber(check.divergenceBps, 2)} bps`);
      if (check.hasOpportunity) {
        console.error(`    >>> ARBITRAGE OPPORTUNITY (${formatNumber(check.divergenceBps, 2)} bps > ${MIN_SPREAD_BPS} bps threshold)`);
      } else if (check.divergenceBps !== null) {
        console.error(`    No opportunity (${formatNumber(check.divergenceBps, 2)} bps below ${MIN_SPREAD_BPS} bps threshold)`);
      } else {
        console.error(`    Insufficient orderbook data on one or both sides`);
      }
    } catch (err) {
      console.error(`    ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.error("");
  }

  const opportunities = results.filter((r) => r.hasOpportunity);
  console.error("=".repeat(70));
  console.error(`  Summary: ${opportunities.length} of ${results.length} pairs have arbitrage opportunities`);
  if (opportunities.length > 0) {
    console.error("");
    for (const opp of opportunities) {
      console.error(`    - ${opp.pair}: ${formatNumber(opp.divergenceBps, 2)} bps divergence`);
    }
  }
  console.error("=".repeat(70));
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
