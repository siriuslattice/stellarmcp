import type { PriceService } from "./price.js";

export interface OracleProvider {
  name: string;
  getPrice(
    base: string,
    counter: string,
  ): Promise<{ price: string; timestamp: string } | null>;
  isAvailable(): Promise<boolean>;
}

export class SdexOracle implements OracleProvider {
  name = "sdex";

  constructor(private priceService: PriceService) {}

  async getPrice(
    base: string,
    counter: string,
  ): Promise<{ price: string; timestamp: string } | null> {
    try {
      const result = await this.priceService.getPrice(base, counter);
      return { price: result.price, timestamp: result.timestamp };
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

export class ReflectorOracle implements OracleProvider {
  name = "reflector";

  // Stub — Reflector.network integration planned for Phase 1 Day 4
  async getPrice(
    _base: string,
    _counter: string,
  ): Promise<{ price: string; timestamp: string } | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
