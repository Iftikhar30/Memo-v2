import { MarketUnit } from '../types';

export interface ParsedVoiceMarketItem {
  rawText: string;
  name: string;
  quantity: number;
  unit: MarketUnit;
  pricePerUnit: number | null;
  confidence?: number;
}

// Convert Bengali numerals to standard Western numerals
export function convertBnDigitsToEn(str: string): string {
  const bnToEnMap: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return str.replace(/[০-৯]/g, (char) => bnToEnMap[char] || char);
}

// Word-based number recognition in Bengali & English
const WORD_NUMBER_MAP: Record<string, number> = {
  'হাফ': 0.5,
  'আধ': 0.5,
  'অর্ধেক': 0.5,
  'half': 0.5,
  'দেড়': 1.5,
  'দেড়': 1.5,
  'আড়াই': 2.5,
  'আড়াই': 2.5,
  'আড়াইশ': 250,
  'আড়াইশো': 250,
  'আড়াইশ': 250,
  'আড়াইশো': 250,
  'আড়াইশত': 250,
  'দেড়শ': 150,
  'দেড়শ': 150,
  'দেড়শো': 150,
  'দেড়শো': 150,
  'একশ': 100,
  'একশো': 100,
  'দুইশ': 200,
  'দুইশো': 200,
  'দুশ': 200,
  'দুশো': 200,
  'তিনশ': 300,
  'তিনশো': 300,
  'চারশ': 400,
  'চারশো': 400,
  'পাঁচশ': 500,
  'পাঁচশো': 500,
  'এক': 1,
  'দুই': 2,
  'তিন': 3,
  'চার': 4,
  'পাঁচ': 5,
  'ছয়': 6,
  'ছয়': 6,
  'সাত': 7,
  'আট': 8,
  'নয়': 9,
  'নয়': 9,
  'দশ': 10,
  'এগারো': 11,
  'বারো': 12,
  'তেরো': 13,
  'চৌদ্দ': 14,
  'পনেরো': 15,
  'ষোল': 16,
  'সতেরো': 17,
  'আঠারো': 18,
  'উনিশ': 19,
  'বিশ': 20,
  'কুড়ি': 20,
  'কুড়ি': 20,
  'পঁচিশ': 25,
  'ত্রিশ': 30,
  'চল্লিশ': 40,
  'পঞ্চাশ': 50,
  'ষাট': 60,
  'সত্তর': 70,
  'আশি': 80,
  'নব্বই': 90,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'twelve': 12,
};

// Unit aliases mapping
const UNIT_RULES: { unit: MarketUnit; patterns: RegExp[] }[] = [
  {
    unit: 'কেজি',
    patterns: [
      /\b(কেজি|কে\.জি\.|কে\.জি|কিলোগ্রাম|কিলো|কিলোর|kg|kgs|kilo|kilogram)\b/i,
      /(কেজি|কিলো|কিলোগ্রাম)/i,
    ],
  },
  {
    unit: 'গ্রাম',
    patterns: [
      /\b(গ্রাম|গ্রামের|gm|gms|g|gram|grams)\b/i,
      /(গ্রাম)/i,
    ],
  },
  {
    unit: 'লিটার',
    patterns: [
      /\b(লিটার|লি\.|লিটারস|liter|litres|litre|ltr|liters)\b/i,
      /(লিটার)/i,
    ],
  },
  {
    unit: 'মিলিলিটার',
    patterns: [
      /\b(মিলিলিটার|মিলি|মি\.লি\.|ml|milli|milliliter)\b/i,
      /(মিলিলিটার|মিলি)/i,
    ],
  },
  {
    unit: 'ডজন',
    patterns: [
      /\b(ডজন|ডজনের|dozen|dozens)\b/i,
      /(ডজন)/i,
    ],
  },
  {
    unit: 'প্যাকেট',
    patterns: [
      /\b(প্যাকেট|প্যাকেটের|প্যাক|packet|packets|pkt)\b/i,
      /(প্যাকেট|প্যাক)/i,
    ],
  },
  {
    unit: 'বোতল',
    patterns: [
      /\b(বোতল|বোতলের|bottle|bottles)\b/i,
      /(বোতল)/i,
    ],
  },
  {
    unit: 'পিস',
    patterns: [
      /\b(পিস|পিসের|piece|pieces|pc|pcs)\b/i,
      /(পিস)/i,
      /\b(টা|টি|খানা|খানি)\b/i,
      /(টা|টি|খানা|খানি)$/i,
    ],
  },
];

// Garbage spoken command words to filter out
const COMMAND_WORDS = [
  'যোগ করো',
  'যোগ কর',
  'যোগ করুন',
  'এড করো',
  'এড কর',
  'এড করুন',
  'এড',
  'add',
  'লিখো',
  'লিখুন',
  'দাও',
  'প্লিজ',
  'আনো',
  'নিয়ে আসো',
  'নিয়ে আসো',
  'কিনে আনো',
  'মেমোতে',
  'তালিকায়',
  'তালিকায়',
];

/**
 * Parses spoken Bengali or English text for a Market Memo item.
 * Example inputs:
 * "আলু ১ কেজি" -> name: "আলু", qty: 1, unit: "কেজি"
 * "মিনিকেট চাল ৫ কেজি দর ৭০" -> name: "মিনিকেট চাল", qty: 5, unit: "কেজি", price: 70
 * "২ কেজি পেঁয়াজ" -> name: "পেঁয়াজ", qty: 2, unit: "কেজি"
 * "ডিম ১২ টা" -> name: "ডিম", qty: 12, unit: "পিস"
 * "সয়াবিন তেল ২ লিটার" -> name: "সয়াবিন তেল", qty: 2, unit: "লিটার"
 * "লবণ" -> name: "লবণ", qty: 1, unit: "কেজি"
 */
export function parseVoiceInputToMarketItem(rawSpokenText: string): ParsedVoiceMarketItem | null {
  if (!rawSpokenText || !rawSpokenText.trim()) return null;

  let cleaned = rawSpokenText.trim();

  // Strip command phrases
  for (const cmd of COMMAND_WORDS) {
    cleaned = cleaned.replace(new RegExp(cmd, 'gi'), ' ');
  }

  // Remove trailing and leading punctuation
  cleaned = cleaned.replace(/^[,\.\-!?:;\s]+|[,\.\-!?:;\s]+$/g, '').trim();
  if (!cleaned) return null;

  // Convert Bengali numerals (০-৯) to English digits (0-9)
  let normalized = convertBnDigitsToEn(cleaned);

  // 1. Extract Price if present (e.g., "দর ৭০", "দাম ৮০ টাকা", "৬০ টাকা", "রেট ৪৫")
  let pricePerUnit: number | null = null;
  const priceRegexes = [
    /(?:দর|রেট|মূল্য|দাম|price)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:টাকা|টাকায়|tk)?/i,
    /(\d+(?:\.\d+)?)\s*(?:টাকা|টাকায়|tk)(?:\s*(?:দর|রেট|মূল্য|দাম))?/i,
  ];

  for (const pRegex of priceRegexes) {
    const match = normalized.match(pRegex);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) {
        pricePerUnit = val;
        // remove price portion from normalized text
        normalized = normalized.replace(match[0], ' ');
        break;
      }
    }
  }

  normalized = normalized.trim().replace(/\s+/g, ' ');

  // 2. Extract Unit
  let detectedUnit: MarketUnit = 'কেজি'; // default fallback
  let unitMatchedText = '';

  for (const rule of UNIT_RULES) {
    for (const pattern of rule.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        detectedUnit = rule.unit;
        unitMatchedText = match[0];
        break;
      }
    }
    if (unitMatchedText) break;
  }

  // 3. Extract Quantity
  let quantity = 1;
  let quantityMatchedText = '';

  // Check for combined word quantities like "সাড়ে তিন", "আড়াইশো", "দেড়", etc.
  if (/(সাড়ে|সাড়ে)\s+তিন/i.test(normalized)) {
    quantity = 3.5;
    quantityMatchedText = normalized.match(/(সাড়ে|সাড়ে)\s+তিন/i)![0];
  } else if (/(সাড়ে|সাড়ে)\s+চার/i.test(normalized)) {
    quantity = 4.5;
    quantityMatchedText = normalized.match(/(সাড়ে|সাড়ে)\s+চার/i)![0];
  } else {
    // Check words dictionary
    const words = normalized.split(/\s+/);
    for (const w of words) {
      const lowerW = w.toLowerCase();
      if (WORD_NUMBER_MAP[lowerW] !== undefined) {
        quantity = WORD_NUMBER_MAP[lowerW];
        quantityMatchedText = w;
        break;
      }
    }

    // If no word number matched, check numeric pattern like "1", "1.5", "500", "0.5", "12"
    if (!quantityMatchedText) {
      const numMatch = normalized.match(/(\d+(?:\.\d+)?)/);
      if (numMatch && numMatch[1]) {
        const parsed = parseFloat(numMatch[1]);
        if (!isNaN(parsed) && parsed > 0) {
          quantity = parsed;
          quantityMatchedText = numMatch[0];
        }
      }
    }
  }

  // 4. Extract Product Name by removing quantity and unit matches
  let remaining = normalized;

  if (quantityMatchedText) {
    remaining = remaining.replace(quantityMatchedText, ' ');
  }
  if (unitMatchedText) {
    remaining = remaining.replace(unitMatchedText, ' ');
  }

  // Clean remaining text
  let productName = remaining
    .replace(/[,\.\-!?:;()_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If after extraction productName is empty (e.g. user just said "আলু"), fallback to cleaned
  if (!productName) {
    productName = cleaned.trim();
  }

  // Capitalize first letter if Latin
  if (/^[a-zA-Z]/.test(productName)) {
    productName = productName.charAt(0).toUpperCase() + productName.slice(1);
  }

  // Auto-adjust default unit based on product heuristics if no unit was explicitly mentioned
  if (!unitMatchedText) {
    const lowerName = productName.toLowerCase();
    if (lowerName.includes('ডিম') || lowerName.includes('লেবু') || lowerName.includes('নারিকেল')) {
      detectedUnit = 'পিস';
    } else if (lowerName.includes('তেল') || lowerName.includes('দুধ') || lowerName.includes('জুস') || lowerName.includes('পানি')) {
      detectedUnit = 'লিটার';
    } else if (lowerName.includes('লবণ') || lowerName.includes('মসলা') || lowerName.includes('বিস্কুট')) {
      detectedUnit = 'প্যাকেট';
    }
  }

  return {
    rawText: rawSpokenText,
    name: productName,
    quantity,
    unit: detectedUnit,
    pricePerUnit,
  };
}

/**
 * Splits raw spoken text into separate product segments and parses each one.
 * Supports:
 * 1. Punctuation / separators: commas, newlines, semicolons.
 * 2. Conjunctions: "এবং", "ও", "আর", "তারপর", "সাথে", "এন্ড", "and", "plus".
 * 3. Continuous speech with multiple quantities/units:
 *    e.g. "আলু ২ কেজি পেঁয়াজ ১ কেজি ডিম ১২ টা তেল ২ লিটার"
 *    e.g. "২ কেজি আলু ১ কেজি পেঁয়াজ ১২ টা ডিম"
 */
export function parseMultipleVoiceMarketItems(rawSpokenText: string): ParsedVoiceMarketItem[] {
  if (!rawSpokenText || !rawSpokenText.trim()) return [];

  let text = rawSpokenText.trim();

  // Strip command words
  for (const cmd of COMMAND_WORDS) {
    text = text.replace(new RegExp(cmd, 'gi'), ' ');
  }

  // Remove leading/trailing punctuation
  text = text.replace(/^[,\.\-!?:;\s]+|[,\.\-!?:;\s]+$/g, '').trim();
  if (!text) return [];

  // Convert Bengali numerals to standard Western numerals for easier boundary detection
  const normalized = convertBnDigitsToEn(text);

  // 1. Initial split by explicit punctuation and conjunction words
  // Note: ' ও ' and ' আর ' must be standalone words
  const explicitSplitRegex = /[,;\n|、]+|(?:\s+(?:এবং|তারপর|সাথে|সঙ্গে|প্লাস|এন্ড|and|plus)\s+)|\s+ও\s+|\s+আর\s+/i;
  const initialChunks = normalized.split(explicitSplitRegex).map((c) => c.trim()).filter(Boolean);

  const subChunks: string[] = [];

  // Units list for regex matching
  const unitRegexStr = '(?:কেজি|কে\\.জি\\.|কে\\.জি|কিলোগ্রাম|কিলো|গ্রাম|লিটার|লি\\.|মিলি|মিলিলিটার|মি\\.লি\\.|ডজন|প্যাকেট|প্যাক|বোতল|পিস|টা|টি|খানা|খানি|kg|kgs|g|gm|liter|litres|litre|ltr|liters|pc|pcs|packet|packets|pkt|bottle|bottles|dozen)';
  const priceRegexStr = '(?:\\s*(?:দর|রেট|মূল্য|দাম|price)?\\s*\\d+(?:\\.\\d+)?\\s*(?:টাকা|টাকায়|tk)?)';

  for (const chunk of initialChunks) {
    // Check Pattern B: Quantity + Unit + Name (e.g. "২ কেজি আলু ১ কেজি পেঁয়াজ")
    // If chunk contains multiple [quantity] [unit] occurrences preceded by words
    const qtyUnitStartPattern = new RegExp(`(\\b\\d+(?:\\.\\d+)?|হাফ|আধ|দেড়|দেড়|আড়াই|আড়াই|এক|দুই|তিন|চার|পাঁচ|ছয়|ছয়|সাত|আট|নয়|নয়|দশ)\\s*${unitRegexStr}`, 'gi');
    const qtyUnitMatches: { index: number; match: string }[] = [];
    let qm: RegExpExecArray | null;
    while ((qm = qtyUnitStartPattern.exec(chunk)) !== null) {
      qtyUnitMatches.push({ index: qm.index, match: qm[0] });
    }

    if (qtyUnitMatches.length > 1 && qtyUnitMatches[0].index === 0) {
      // Chunk begins with quantity+unit, so each subsequent quantity+unit marks a new item!
      let lastIdx = 0;
      for (let i = 1; i < qtyUnitMatches.length; i++) {
        const part = chunk.slice(lastIdx, qtyUnitMatches[i].index).trim();
        if (part) subChunks.push(part);
        lastIdx = qtyUnitMatches[i].index;
      }
      const lastPart = chunk.slice(lastIdx).trim();
      if (lastPart) subChunks.push(lastPart);
      continue;
    }

    // Pattern A: Name + Quantity + Unit (e.g. "আলু ২ কেজি পেঁয়াজ ১ কেজি ডিম ১২ টা")
    // Find all occurrences of [unit] + optional [price]
    const unitEndPattern = new RegExp(`(${unitRegexStr}${priceRegexStr}?)`, 'gi');
    const unitMatches: { start: number; end: number; match: string }[] = [];
    let um: RegExpExecArray | null;
    while ((um = unitEndPattern.exec(chunk)) !== null) {
      unitMatches.push({ start: um.index, end: um.index + um[0].length, match: um[0] });
    }

    if (unitMatches.length > 1) {
      let lastIndex = 0;
      for (let i = 0; i < unitMatches.length; i++) {
        const isLast = i === unitMatches.length - 1;
        const splitPoint = isLast ? chunk.length : unitMatches[i].end;
        const part = chunk.slice(lastIndex, splitPoint).trim();
        if (part) {
          subChunks.push(part);
        }
        lastIndex = unitMatches[i].end;
      }
      if (lastIndex < chunk.length) {
        const remainder = chunk.slice(lastIndex).trim();
        if (remainder) subChunks.push(remainder);
      }
      continue;
    }

    // Single item chunk
    subChunks.push(chunk);
  }

  // Parse each chunk and collect valid items
  const results: ParsedVoiceMarketItem[] = [];

  for (const c of subChunks) {
    const item = parseVoiceInputToMarketItem(c);
    if (item && item.name.trim() && item.quantity > 0) {
      // Avoid adding items where name is purely punctuation or numbers
      const cleanName = item.name.replace(/[0-9\.,\-]/g, '').trim();
      if (cleanName.length > 0) {
        results.push(item);
      }
    }
  }

  return results;
}
