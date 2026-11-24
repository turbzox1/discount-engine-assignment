const VALID_SCOPES = new Set(['brand', 'platform', 'cart'])
const VALID_TYPES = new Set(['percentage', 'flat'])

export function generateNextRuleId(existingRuleIds = []) {
  const maxNum = existingRuleIds.reduce((max, id) => {
    const match = String(id).match(/RULE-(\d+)/i)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `RULE-${String(maxNum + 1).padStart(2, '0')}`
}

export function validateParsedRule(raw, existingRuleIds = []) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Could not interpret a structured rule. Specify a target, discount type, and value.' }
  }

  const scope = String(raw.scope ?? '').trim().toLowerCase()
  if (!VALID_SCOPES.has(scope)) {
    return { ok: false, error: `Missing or unsupported scope ("${raw.scope ?? ''}"). Mention a brand, platform, or cart total.` }
  }

  const type = String(raw.type ?? '').trim().toLowerCase()
  if (!VALID_TYPES.has(type)) {
    return { ok: false, error: `Missing or unsupported discount type ("${raw.type ?? ''}"). Use a percentage or flat rupee amount.` }
  }

  const value = Number(raw.value)
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Discount value must be a positive number (e.g. 15% or Rs.150).' }
  }
  if (type === 'percentage' && value > 100) {
    return { ok: false, error: `Percentage discount (${value}%) cannot exceed 100%.` }
  }

  const appliesToRaw = String(raw.appliesTo ?? raw.applies_to ?? '').trim()
  if (scope !== 'cart' && !appliesToRaw) {
    return { ok: false, error: `Please specify which ${scope} this rule applies to (e.g. "Natura Casa" or "Flipkart").` }
  }

  let minCartValue = null
  if (scope === 'cart') {
    const rawMin = raw.minCartValue ?? raw.min_cart_value
    if (rawMin === null || rawMin === undefined || rawMin === '') {
      return { ok: false, error: 'Cart-level rules require a minimum cart value (e.g. "if cart value is more than Rs.5,000").' }
    }
    minCartValue = Number(rawMin)
    if (!Number.isFinite(minCartValue) || minCartValue < 0) {
      return { ok: false, error: 'Minimum cart value must be a valid non-negative rupee amount.' }
    }
  }

  return {
    ok: true,
    rule: {
      ruleId: generateNextRuleId(existingRuleIds),
      scope,
      appliesTo: scope === 'cart' ? 'Entire cart' : appliesToRaw,
      type,
      value,
      stackable: Boolean(raw.stackable),
      minCartValue,
    },
  }
}

export const NL_RULE_SYSTEM_PROMPT = `You are a strict discount-rule parser for an e-commerce pricing engine.
Convert the user's plain-English discount description into ONLY valid JSON matching ONE of two shapes:

1) Specific, valid rule:
{
  "status": "ok",
  "rule": {
    "scope": "brand" | "platform" | "cart",
    "appliesTo": string,
    "type": "percentage" | "flat",
    "value": number,
    "stackable": boolean,
    "minCartValue": number | null
  }
}

2) Ambiguous or incomplete input (missing discount value, target brand/platform, or cart threshold):
{
  "status": "ambiguous",
  "reason": string,
  "suggestion": string
}

Rules:
- For scope="cart", set appliesTo to "Entire cart" and require a numeric minCartValue.
- Set stackable=true ONLY if the user explicitly mentions stackable/combinable; otherwise false.
- Never invent missing numbers, brands, platforms, or thresholds.`

export async function parseNaturalLanguageRule(userText, existingRuleIds = [], config = {}) {
  const trimmed = String(userText ?? '').trim()
  if (!trimmed) {
    return { ok: false, ambiguous: true, error: 'Please describe a discount rule first.' }
  }

  const apiKey = config.apiKey || import.meta?.env?.VITE_LLM_API_KEY
  const apiUrl =
    config.apiUrl ||
    import.meta?.env?.VITE_LLM_API_URL ||
    'https://api.openai.com/v1/chat/completions'
  const model = config.model || import.meta?.env?.VITE_LLM_MODEL || 'gpt-4o-mini'
  const fetcher = config.fetcher ?? fetch

  if (!apiKey) {
    return {
      ok: false,
      ambiguous: false,
      error: 'No LLM API key configured. Enter an OpenAI-compatible API key below or set VITE_LLM_API_KEY in your environment.',
    }
  }

  try {
    const response = await fetcher(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: NL_RULE_SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
      }),
    })

    if (!response.ok) {
      return { ok: false, ambiguous: false, error: `LLM API returned HTTP ${response.status}. Verify your API key and endpoint.` }
    }

    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (!content) {
      return { ok: false, ambiguous: false, error: 'LLM returned an empty response.' }
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return { ok: false, ambiguous: false, error: 'LLM returned malformed JSON. Please try again.' }
    }

    if (parsed.status === 'ambiguous') {
      const tip = parsed.suggestion ? ` Try: "${parsed.suggestion}"` : ''
      return {
        ok: false,
        ambiguous: true,
        error: `${parsed.reason || 'Input is too ambiguous to create a rule.'}${tip}`,
      }
    }

    const validated = validateParsedRule(parsed.rule, existingRuleIds)
    if (!validated.ok) {
      return { ok: false, ambiguous: true, error: validated.error }
    }

    return { ok: true, ambiguous: false, rule: validated.rule }
  } catch (err) {
    return { ok: false, ambiguous: false, error: `Rule parser request failed: ${err?.message || 'Network error'}` }
  }
}
