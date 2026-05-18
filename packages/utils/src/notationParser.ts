/**
 * SRP: Strict validation for individual tokens.
 */
class PatternValidator {
  // Letters s,r,g,m,p,d,n with modifiers and dots before OR after (not both), or hyphen.
  private static readonly NOTE_REGEX =
    /^(\*)?(\.{1,2})[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?$|^(\*)?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?(\.{1,2})$|^(\*)?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?$|^-$/;
  private static readonly OPEN_SLASH_MODIFIER = /^\/(\d+|md|kn|gh|mu|aa|ch)$/;

  static isNote(val: string): boolean {
    return this.NOTE_REGEX.test(val);
  }

  static isOpenSlash(val: string): boolean {
    return this.OPEN_SLASH_MODIFIER.test(val);
  }
}

export interface PhraseRow {
  type: string;
  content: (string | PhraseRow)[];
}

export type ParsedPhraseCell = {
  phraseIndex: number;
  beatIndex: number;
  data: (string | PhraseRow)[];
  span?: number;
};

/**
 * SRP: Manages the hierarchical grouping and symmetry logic.
 */
class NestedMusicParser {
  // Regex identifies: /modifier, standalone /, (, ), <, >, notes with dots/modifiers, or hyphens.
  private static readonly TOKEN_EXTRACTOR =
    /\/(\d+|md|kn|gh|mu|aa|ch)|\/|\(|\)|<|>|\||(\*)?(\.{1,2})?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?(\.{1,2})?|-/g;

  public parseInput(input: string): ParsedPhraseCell[] {
    if (!input || !input.trim()) return [];

    const rawPhrases = input
      .split(',')
      .map((p) => p.trim())
      .filter(p => p.length > 0);
    
    let currentGlobalBeat = 1;

    const result = rawPhrases.map((phrase, index) => {
      const tokens = this.extractAndValidate(phrase);
      const data = this.buildHierarchy(tokens);
      
      const phraseBeatIndex = currentGlobalBeat;
      
      // Determine how many beats this phrase covers
      let beatsInThisPhrase = 1;
      const firstToken = data[0];
      if (firstToken && typeof firstToken !== 'string') {
        const spanMatch = firstToken.type.match(/^\/(\d+)$/);
        if (spanMatch) {
          beatsInThisPhrase = parseInt(spanMatch[1], 10);
        }
      }
      
      const cell = {
        phraseIndex: index + 1,
        beatIndex: phraseBeatIndex,
        data: data,
        span: beatsInThisPhrase
      };
      
      currentGlobalBeat += beatsInThisPhrase;
      return cell;
    });

    return result as any;
  }

  private extractAndValidate(phrase: string): string[] {
    const matches = Array.from(phrase.matchAll(NestedMusicParser.TOKEN_EXTRACTOR));
    const tokens: string[] = [];

    for (const match of matches) {
      const t = match[0];
      // If it's not a syntax char (/, (, ), <, >), validate it as a music note/hyphen
      if (!['/', '(', ')', '<', '>', '|'].includes(t) && !PatternValidator.isOpenSlash(t)) {
        if (!PatternValidator.isNote(t)) {
          // Instead of throwing, we'll just skip or treat as string in mobile for safety
          console.warn(`Validation Warning: "${t}" violates the dot or letter rules.`);
        }
      }
      tokens.push(t);
    }
    return tokens;
  }

  private buildHierarchy(tokens: string[]): (string | PhraseRow)[] {
    const root: (string | PhraseRow)[] = [];
    const stack: { content: (string | PhraseRow)[]; type: string }[] = [{ content: root, type: 'root' }];
    let isInsideParen = false;
    let isInsideAngle = false;

    for (const token of tokens) {
      const currentLevel = stack[stack.length - 1];

      if (PatternValidator.isOpenSlash(token)) {
        const newRow: PhraseRow = { type: token, content: [] };
        currentLevel.content.push(newRow);
        stack.push(newRow);
      } else if (token === '(') {
        if (isInsideParen) continue; 
        isInsideParen = true;
        const newRow: PhraseRow = { type: token, content: [] };
        currentLevel.content.push(newRow);
        stack.push(newRow);
      } else if (token === '<') {
        if (isInsideAngle) continue;
        isInsideAngle = true;
        const newRow: PhraseRow = { type: '<', content: [] };
        currentLevel.content.push(newRow);
        stack.push(newRow);
      } else if (token === '/') {
        if (stack.length > 1 && PatternValidator.isOpenSlash(stack[stack.length - 1].type)) {
          stack.pop();
        }
      } else if (token === ')') {
        if (isInsideParen) {
          isInsideParen = false;
          stack.pop();
        }
      } else if (token === '>') {
        if (isInsideAngle) {
          isInsideAngle = false;
          stack.pop();
        }
      } else {
        currentLevel.content.push(token);
      }
    }

    return root;
  }
}

export function parseNestedMusicInput(input: string): ParsedPhraseCell[] {
  const parser = new NestedMusicParser();
  try {
    return parser.parseInput(input);
  } catch (e) {
    console.error("Parse Error:", e);
    return [];
  }
}
