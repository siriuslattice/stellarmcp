export const TOOL_PRICES: Record<string, string> = {
  "/tools/getAccount": "$0.001",
  "/tools/getTransactions": "$0.001",
  "/tools/getPayments": "$0.001",
  "/tools/getOrderbook": "$0.002",
  "/tools/getTradeAggregations": "$0.002",
  "/tools/getAssetInfo": "$0.001",
  "/tools/getLedger": "$0.001",
  "/tools/getEffects": "$0.001",
  "/tools/getOffers": "$0.001",
  "/tools/getOperations": "$0.001",
  "/tools/getLiquidityPools": "$0.001",
  "/tools/getClaimableBalances": "$0.001",
  "/tools/getPrice": "$0.002",
  "/tools/getPriceHistory": "$0.002",
  "/tools/getVWAP": "$0.002",
};

export const FREE_ROUTES = new Set(["/tools/getNetworkStatus", "/health", "/skill.md", "/mcp"]);
