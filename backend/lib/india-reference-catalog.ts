/**
 * Curated public-reference identifiers for the India preview. This is not an
 * exchange feed, not a complete universe and contains no quote, OHLCV, rank,
 * corporate-action, fundamental, or forecast values. A licensed instrument
 * master replaces this catalogue before a production market-data launch.
 */
export type IndiaReferenceInstrument = {
  instrumentId: string;
  exchange: "NSE";
  symbol: string;
  companyName: string;
  aliases: string[];
  /** ISIN is intentionally omitted until the licensed instrument master syncs it. */
  isin?: string | null;
  tradingStatus: "reference_only";
  sourceUrl: string;
};

const nseReference = "https://www.nseindia.com/market-data/securities-available-for-trading";
const india = (symbol: string, companyName: string, aliases: string[] = []): IndiaReferenceInstrument => ({
  instrumentId: `NSE:${symbol}`, exchange: "NSE", symbol, companyName, aliases,
  tradingStatus: "reference_only", sourceUrl: nseReference,
});

export const indiaReferenceCatalogue: IndiaReferenceInstrument[] = [
  india("TCS", "Tata Consultancy Services Limited", ["Tata Consultancy", "TCS"]),
  india("TATAMOTORS", "Tata Motors Limited", ["Tata Motors"]),
  india("TATAPOWER", "Tata Power Company Limited", ["Tata Power"]),
  india("TATASTEEL", "Tata Steel Limited", ["Tata Steel"]),
  india("TATACONSUM", "Tata Consumer Products Limited", ["Tata Consumer"]),
  india("TATACHEM", "Tata Chemicals Limited", ["Tata Chemicals"]),
  india("TATACOMM", "Tata Communications Limited", ["Tata Communications"]),
  india("TATAELXSI", "Tata Elxsi Limited", ["Tata Elxsi"]),
  india("TATATECH", "Tata Technologies Limited", ["Tata Technologies"]),
  india("TATAINVEST", "Tata Investment Corporation Limited", ["Tata Investment"]),
  india("TTML", "Tata Teleservices (Maharashtra) Limited", ["Tata Teleservices", "Tata Tele"]),
  india("TITAN", "Titan Company Limited", ["Titan", "Tata Titan"]),
  india("TRENT", "Trent Limited", ["Trent", "Tata Trent", "Westside"]),
  india("INDHOTEL", "The Indian Hotels Company Limited", ["Indian Hotels", "Taj Hotels", "Tata Hotels"]),
  india("VOLTAS", "Voltas Limited", ["Voltas", "Tata Voltas"]),
  india("NELCO", "NELCO Limited", ["Nelco", "Tata Nelco"]),
  india("RELIANCE", "Reliance Industries Limited", ["Reliance", "RIL"]),
  india("HDFCBANK", "HDFC Bank Limited", ["HDFC Bank"]),
  india("ICICIBANK", "ICICI Bank Limited", ["ICICI Bank"]),
  india("INFY", "Infosys Limited", ["Infosys"]),
  india("SBIN", "State Bank of India", ["SBI"]),
  india("ITC", "ITC Limited", ["ITC"]),
  india("BHARTIARTL", "Bharti Airtel Limited", ["Airtel"]),
  india("LT", "Larsen & Toubro Limited", ["L and T", "L&T"]),
  india("MARUTI", "Maruti Suzuki India Limited", ["Maruti"]),
  india("SUNPHARMA", "Sun Pharmaceutical Industries Limited", ["Sun Pharma"]),
  india("M&M", "Mahindra & Mahindra Limited", ["Mahindra"]),
  india("HINDUNILVR", "Hindustan Unilever Limited", ["HUL"]),
  india("KOTAKBANK", "Kotak Mahindra Bank Limited", ["Kotak Bank"]),
];

export const INDIA_REFERENCE_CATALOGUE_NOTICE = "India reference catalogue: curated identifiers only, incomplete, and not live market data. Quotes, charts, rankings, and forecasts require an authorized provider.";
