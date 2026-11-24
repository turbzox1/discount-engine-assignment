import { useState } from 'react'
import { parseCartPdfFile } from '../parsers/pdfCartParser.js'

const S = {
  wrap: { marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid #e5e5e5' },
  label: { fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 6, display: 'block' },
  input: { fontSize: 12 },
  note: { fontSize: 11, color: '#666', marginTop: 4 },
  error: {
    marginTop: 8, padding: '0.55rem 0.75rem', background: '#fff4f2',
    border: '1px solid #f0b8b0', borderRadius: 4, fontSize: 12, color: '#9e2a2b',
  },
  warn: {
    marginTop: 8, padding: '0.55rem 0.75rem', background: '#fffbeb',
    border: '1px solid #f5d08a', borderRadius: 4, fontSize: 11, color: '#7c4d03',
  },
}

export default function PdfCartUpload({ onLoadPdfCart }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setWarnings([])

    const res = await parseCartPdfFile(file)
    setLoading(false)

    if (!res.ok) {
      setError(res.error)
      setWarnings(res.warnings || [])
      e.target.value = ''
      return
    }

    setWarnings(res.warnings || [])
    onLoadPdfCart(res.items, file.name)
    e.target.value = ''
  }

  return (
    <div style={S.wrap}>
      <label htmlFor="cart-pdf-upload" style={S.label}>
        Or Upload Cart PDF
      </label>
      <input
        id="cart-pdf-upload"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        disabled={loading}
        style={S.input}
      />
      <div style={S.note}>
        {loading
          ? 'Extracting items from PDF...'
          : 'Replaces current cart (columns: Product, Brand, Platform, Base Price)'}
      </div>

      {error && <div style={S.error} role="alert">{error}</div>}

      {warnings.length > 0 && (
        <div style={S.warn} role="status">
          <strong>Skipped {warnings.length} malformed row{warnings.length > 1 ? 's' : ''}:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
