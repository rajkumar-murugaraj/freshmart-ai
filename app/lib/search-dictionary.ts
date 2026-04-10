// Hindi/regional synonyms → English product names
export const synonymMap: Record<string, string> = {
  'dahi': 'curd', 'chawal': 'rice', 'aloo': 'potato', 'tamatar': 'tomato',
  'pyaaz': 'onion', 'pyaz': 'onion', 'atta': 'flour', 'maida': 'refined flour',
  'besan': 'gram flour', 'dal': 'lentils', 'daal': 'lentils', 'sabzi': 'vegetables',
  'phal': 'fruits', 'doodh': 'milk', 'dudh': 'milk', 'paneer': 'cottage cheese',
  'ghee': 'ghee', 'makhan': 'butter', 'cheeni': 'sugar', 'shakkar': 'sugar',
  'namak': 'salt', 'mirch': 'chilli', 'haldi': 'turmeric', 'jeera': 'cumin',
  'dhania': 'coriander', 'adrak': 'ginger', 'lahsun': 'garlic', 'palak': 'spinach',
  'gobhi': 'cauliflower', 'gajar': 'carrot', 'matar': 'peas', 'bhindi': 'okra',
  'baingan': 'eggplant', 'kela': 'banana', 'seb': 'apple', 'aam': 'mango',
  'nimbu': 'lemon', 'anda': 'egg', 'ande': 'eggs', 'roti': 'bread',
  'chai': 'tea', 'pani': 'water', 'tel': 'oil', 'sarson': 'mustard',
  'tom': 'tomato', 'pot': 'potato', 'chkn': 'chicken', 'veg': 'vegetables',
};

// Common misspellings → correct spellings
export const misspellingMap: Record<string, string> = {
  'toamto': 'tomato', 'tomto': 'tomato', 'tomatoe': 'tomato',
  'potao': 'potato', 'potatto': 'potato', 'potatoe': 'potato',
  'banan': 'banana', 'bananna': 'banana', 'oinon': 'onion', 'onin': 'onion',
  'oniom': 'onion', 'aple': 'apple', 'appl': 'apple',
  'oragne': 'orange', 'ornage': 'orange', 'millk': 'milk',
  'bred': 'bread', 'breade': 'bread', 'chese': 'cheese', 'cheeze': 'cheese',
  'yogrt': 'yogurt', 'yougurt': 'yogurt', 'yoghrt': 'yogurt',
  'jucie': 'juice', 'juic': 'juice', 'cofee': 'coffee', 'coffe': 'coffee',
  'suger': 'sugar', 'sugur': 'sugar', 'chiken': 'chicken', 'chicke': 'chicken',
  'letuce': 'lettuce', 'brocoli': 'broccoli', 'brocolli': 'broccoli',
  'cucmber': 'cucumber', 'spianch': 'spinach', 'spinch': 'spinach',
  'cabage': 'cabbage', 'cabbge': 'cabbage', 'mushrrom': 'mushroom',
  'mashroom': 'mushroom', 'watermlon': 'watermelon', 'watermellon': 'watermelon',
  'graps': 'grapes', 'grappes': 'grapes', 'strabery': 'strawberry',
  'stawberry': 'strawberry', 'chocolte': 'chocolate', 'choclate': 'chocolate',
  'biscut': 'biscuit', 'biskit': 'biscuit', 'noodels': 'noodles', 'noodls': 'noodles',
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export interface AutocorrectResult {
  corrected: string;
  type: 'synonym' | 'misspelling' | 'fuzzy';
  original: string;
}

export function autocorrect(query: string, productNames: string[]): AutocorrectResult | null {
  const lower = query.toLowerCase().trim();
  if (!lower) return null;

  if (synonymMap[lower]) return { corrected: synonymMap[lower], type: 'synonym', original: query };
  if (misspellingMap[lower]) return { corrected: misspellingMap[lower], type: 'misspelling', original: query };

  // Multi-word: try correcting each word
  const words = lower.split(/\s+/);
  if (words.length > 1) {
    let changed = false;
    const correctedWords = words.map(word => {
      if (synonymMap[word]) { changed = true; return synonymMap[word]; }
      if (misspellingMap[word]) { changed = true; return misspellingMap[word]; }
      return word;
    });
    if (changed) return { corrected: correctedWords.join(' '), type: 'synonym', original: query };
  }

  // Levenshtein fuzzy match against product name words
  if (lower.length >= 3) {
    let bestMatch: string | null = null;
    let bestDistance = Infinity;
    const maxDistance = lower.length <= 4 ? 1 : 2;
    const productWords = new Set<string>();
    for (const name of productNames) {
      for (const word of name.toLowerCase().split(/\s+/)) {
        if (word.length >= 3) productWords.add(word);
      }
    }
    for (const word of Array.from(productWords)) {
      const dist = levenshtein(lower, word);
      if (dist > 0 && dist <= maxDistance && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = word;
      }
    }
    if (bestMatch) return { corrected: bestMatch, type: 'fuzzy', original: query };
  }

  return null;
}
