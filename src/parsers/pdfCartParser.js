export function parsePriceToken(rawPrice) {
  const cleaned = String(rawPrice ?? '')
    .trim()
    .replace(/^(?:rs\.?|inr|₹)\s*/i, '')
    .replace(/,/g, '')

  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null
  const num = Number(cleaned)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

function isHeaderOrNoiseLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (/^[-─═_=|]+$/.test(trimmed)) return true
  if (/^order\s*#/i.test(trimmed)) return true
  if (/^date\s*:/i.test(trimmed)) return true
  if (/^product\b.*\bbrand\b.*\bplatform\b.*\bprice/i.test(trimmed)) return true
  if (/^(?:total|subtotal|grand total|page\s+\d+)/i.test(trimmed)) return true
  return false
}

export function parseCartRows(rawRows) {
  const items = []
  const warnings = []

  for (let i = 0; i < rawRows.length; i++) {
    const cells = rawRows[i].map((c) => String(c ?? '').trim()).filter(Boolean)
    if (cells.length === 0) continue

    const joined = cells.join(' ')
    if (isHeaderOrNoiseLine(joined)) continue

    const cols =
      cells.length === 1
        ? cells[0].split(/\s{2,}|\t+/).map((s) => s.trim()).filter(Boolean)
        : cells

    if (cols.length < 4) {
      warnings.push(
        `Row ${i + 1} skipped ("${joined}"): expected 4 columns (Product, Brand, Platform, Base Price), found ${cols.length}.`
      )
      continue
    }

    const basePriceRaw = cols[cols.length - 1]
    const platform = cols[cols.length - 2]
    const brand = cols[cols.length - 3]
    const product = cols.slice(0, cols.length - 3).join(' ')

    const basePrice = parsePriceToken(basePriceRaw)
    if (!product || !brand || !platform || basePrice === null) {
      warnings.push(`Row ${i + 1} skipped ("${joined}"): invalid or missing price/field.`)
      continue
    }

    items.push({
      itemId: `ITEM-${String(items.length + 1).padStart(2, '0')}`,
      product,
      brand,
      platform,
      basePrice,
    })
  }

  return { items, warnings }
}

export function clusterPdfTextItemsIntoRows(textItems, yTolerance = 3, colGapThreshold = 14) {
  const nonEmpty = textItems
    .filter((item) => item && typeof item.str === 'string' && item.str.trim() !== '')
    .map((item) => ({
      str: item.str.trim(),
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? item.str.length * 5,
    }))

  nonEmpty.sort((a, b) => {
    if (Math.abs(b.y - a.y) > yTolerance) return b.y - a.y
    return a.x - b.x
  })

  const rows = []
  for (const token of nonEmpty) {
    const lastRow = rows[rows.length - 1]
    if (lastRow && Math.abs(lastRow.y - token.y) <= yTolerance) {
      lastRow.tokens.push(token)
    } else {
      rows.push({ y: token.y, tokens: [token] })
    }
  }

  return rows.map((row) => {
    row.tokens.sort((a, b) => a.x - b.x)
    const cells = []
    for (const token of row.tokens) {
      const prev = cells[cells.length - 1]
      if (!prev) {
        cells.push({ text: token.str, endX: token.x + token.width })
      } else if (token.x - prev.endX > colGapThreshold) {
        cells.push({ text: token.str, endX: token.x + token.width })
      } else {
        prev.text = `${prev.text} ${token.str}`
        prev.endX = Math.max(prev.endX, token.x + token.width)
      }
    }
    return cells.map((c) => c.text)
  })
}

export async function parseCartPdfFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'Please upload a valid .pdf file.', warnings: [] }
  }

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString()

    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

    const allRows = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      allRows.push(...clusterPdfTextItemsIntoRows(textContent.items))
    }

    const { items, warnings } = parseCartRows(allRows)
    if (items.length === 0) {
      return {
        ok: false,
        error: 'No valid cart items found in PDF. Ensure it has a text table with Product, Brand, Platform, and Base Price columns.',
        warnings,
      }
    }

    return { ok: true, items, warnings }
  } catch (err) {
    return { ok: false, error: `Failed to read PDF: ${err?.message || 'Unknown error'}`, warnings: [] }
  }
}
