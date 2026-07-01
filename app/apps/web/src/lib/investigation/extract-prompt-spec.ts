/**
 * Stable inputs to `computeExtractorVersion()`. Pulled out into its own file
 * so the hashing module is decoupled from the longer prompt definition. The
 * full prompt and tool-use orchestration live in `extract-prompt.ts`.
 *
 * IMPORTANT: bumping either of these strings is what produces a fresh
 * extractor version (FR-002 / FR-003).
 */
export const EXTRACT_PROMPT_TEMPLATE = `Te a Korruptométer kinyerő eszköze vagy.
Olvasd el a magyar nyelvű hírcikket és bontsd külön minden konkrét korrupciós
állítást egy strukturált rekordra. Egy állítás = egy elkülönülő mechanizmus +
résztvevőcsoport. Soha ne találd ki a tényeket. Csak akkor készíts rekordot,
ha a cikk szövege idézhető bizonyítékkal alátámasztja. Ha a cikk nem tartalmaz
korrupciós állítást, üres listát adj vissza.

Minden rekord MUST tartalmazzon:
- mechanism: az ENUM egyik értéke.
- parties: legalább egy tagja a (kind, name, normalizedName, role) szerint;
  normalizedName = ékezet nélkül, kisbetűsen, magyar megszólítók (dr., id., ifj.) nélkül.
- evidenceQuote: szó szerinti idézet a cikk testéből.
- sourceUrl: a cikk kanonikus URL-je.
- paragraphLocator: pl. "p:14" vagy CSS-szelektor stílusú azonosító.
- model + confidence (0..100).

amountBasis non-null MUST iff allegedAmountHuf non-null.

Csak akkor nyelj el egy állítást, ha az evidenceQuote+sourceUrl+paragraphLocator
hárma egyszerre nem üres.`;

export const EXTRACT_JSON_SCHEMA = {
  type: 'object',
  required: ['claims'],
  additionalProperties: false,
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'mechanism',
          'parties',
          'evidenceQuote',
          'sourceUrl',
          'paragraphLocator',
          'confidence',
        ],
        additionalProperties: false,
        properties: {
          mechanism: {
            type: 'string',
            enum: [
              'overpricing',
              'no_bid',
              'kickback',
              'amendment_inflation',
              'phantom_service',
              'related_party',
              'other',
            ],
          },
          allegedAmountHuf: { type: ['integer', 'null'] },
          amountBasis: {
            type: ['string', 'null'],
            enum: ['stated', 'computed', 'estimated', null],
          },
          parties: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['kind', 'name', 'normalizedName', 'role'],
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: ['person', 'entity'] },
                name: { type: 'string', minLength: 1 },
                normalizedName: { type: 'string', minLength: 1 },
                role: { type: 'string', minLength: 1 },
              },
            },
          },
          evidenceQuote: { type: 'string', minLength: 1 },
          sourceUrl: { type: 'string', minLength: 1 },
          paragraphLocator: { type: 'string', minLength: 1 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const;
