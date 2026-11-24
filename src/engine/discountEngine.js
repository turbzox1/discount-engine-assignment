export function ruleMatchesItem(item, rule) {
  const normalise = (s) => String(s ?? '').trim().toLowerCase()
  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }
  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }
  return false
}

export function calculateDiscountAmount(price, rule) {
  if (price <= 0) return 0
  if (rule.type === 'percentage') {
    return Math.min(price, Math.round((price * rule.value) / 100))
  }
  if (rule.type === 'flat') {
    return Math.min(price, Math.round(rule.value))
  }
  return 0
}

function ruleToReasoning(rule) {
  const scopeLabel = rule.scope === 'brand' ? 'Brand' : 'Platform'
  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }
  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }
  return `${scopeLabel} offer applied`
}

export function applyDiscounts(item, rules) {
  const matchingRules = rules.filter((r) => ruleMatchesItem(item, r))

  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((r) => !r.stackable)
  const stackable = matchingRules.filter((r) => r.stackable)

  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a)
    )
    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  let price = item.basePrice
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    price = Math.max(0, price - calculateDiscountAmount(price, winner))
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    price = Math.max(0, price - calculateDiscountAmount(price, rule))
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = Math.round(price)

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount: item.basePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((r) => r.ruleId),
    reasoning: reasoningParts.join(' + '),
  }
}

export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

export function cartTotal(results) {
  return results.reduce((sum, r) => sum + r.finalPrice, 0)
}

export function evaluateCartOffer(subtotal, rules) {
  const qualifying = rules.filter(
    (r) => r.scope === 'cart' && subtotal >= (Number(r.minCartValue) || 0)
  )
  if (qualifying.length === 0) return null

  const nonStackable = qualifying.filter((r) => !r.stackable)
  const stackable = qualifying.filter((r) => r.stackable)

  let runningTotal = subtotal
  const applied = []

  if (nonStackable.length > 0) {
    const best = [...nonStackable].sort(
      (a, b) => calculateDiscountAmount(subtotal, b) - calculateDiscountAmount(subtotal, a)
    )[0]
    runningTotal = Math.max(0, runningTotal - calculateDiscountAmount(runningTotal, best))
    applied.push(best)
  }

  for (const rule of stackable) {
    runningTotal = Math.max(0, runningTotal - calculateDiscountAmount(runningTotal, rule))
    applied.push(rule)
  }

  const discountAmount = Math.round(subtotal - runningTotal)
  if (discountAmount <= 0 || applied.length === 0) return null

  const primary = applied[0]
  const valueDesc =
    primary.type === 'percentage'
      ? `${primary.value}% off`
      : `Rs.${primary.value.toLocaleString('en-IN')} off`

  const label =
    applied.length === 1
      ? `Cart offer: ${valueDesc} — Rs.${discountAmount.toLocaleString('en-IN')} saved`
      : `Cart offers (${applied.map((r) => r.ruleId).join(' + ')}): Rs.${discountAmount.toLocaleString('en-IN')} saved`

  return {
    ruleId: primary.ruleId,
    appliedRuleIds: applied.map((r) => r.ruleId),
    threshold: Number(primary.minCartValue) || 0,
    discountAmount,
    finalCartTotal: Math.max(0, subtotal - discountAmount),
    label,
  }
}

export function processCheckout(cartItems, rules) {
  const items = processCart(cartItems, rules)
  const subtotal = cartTotal(items)
  const cartOffer = evaluateCartOffer(subtotal, rules)
  const finalTotal = cartOffer ? cartOffer.finalCartTotal : subtotal
  return { items, subtotal, cartOffer, finalTotal }
}
