import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import NaturalLanguageRuleInput from './components/NaturalLanguageRuleInput.jsx'
import PdfCartUpload from './components/PdfCartUpload.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { processCheckout } from './engine/discountEngine.js'

const RULES_COLUMNS = [
  { key: 'ruleId', label: 'Rule ID' },
  { key: 'scope', label: 'Scope', render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type', label: 'Type', render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => (row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`),
  },
  {
    key: 'minCartValue',
    label: 'Condition',
    render: (v, row) =>
      row.scope === 'cart' && v != null ? `Cart ≥ Rs.${Number(v).toLocaleString('en-IN')}` : '—',
  },
  { key: 'stackable', label: 'Stackable', render: (v) => (v ? 'Yes' : 'No') },
]

const CART_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'brand', label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  {
    key: 'finalPrice',
    label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span
        style={{
          color: v === 'No offers available' ? '#888' : '#131A48',
          fontStyle: v === 'No offers available' ? 'italic' : 'normal',
        }}
      >
        {v}
      </span>
    ),
  },
]

const S = {
  page: { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header: { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan: { color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main: { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn: {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  summaryBlock: { marginTop: '0.85rem', borderTop: '2px solid #131A48', paddingTop: '0.75rem' },
  summaryLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13, color: '#131A48' },
  cartOfferLine: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0.75rem', margin: '0.5rem 0', borderRadius: 4,
    background: '#edf7ed', border: '1px solid #b7dfb9', color: '#1e5c2c',
    fontSize: 13, fontWeight: 600,
  },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e5e5' },
  totalLabel: { fontWeight: 700, fontSize: 15, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 17, color: '#131A48' },
}

export default function App() {
  const [rules, setRules] = useState([])
  const [rulesErrors, setRulesErr] = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems] = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName] = useState('')

  const [checkout, setCheckout] = useState(null)

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setCheckout(null)
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setCheckout(null)
  }

  function handleAddNaturalLanguageRule(newRule) {
    const nextRules = [...rules, newRule]
    setRules(nextRules)
    if (cartItems.length > 0) {
      setCheckout(processCheckout(cartItems, nextRules))
    }
  }

  function handleLoadPdfCart(parsedItems, fileName) {
    setCartItems(parsedItems)
    setCartErrors([])
    setCartFileName(fileName)
    if (rules.length > 0) {
      setCheckout(processCheckout(parsedItems, rules))
    } else {
      setCheckout(null)
    }
  }

  function handleCalculate() {
    setCheckout(processCheckout(cartItems, rules))
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>
        <div style={S.grid2}>
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />

            <NaturalLanguageRuleInput
              existingRuleIds={rules.map((r) => r.ruleId)}
              onAddRule={handleAddNaturalLanguageRule}
            />

            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />
            <ErrorBanner errors={cartErrors} />

            <PdfCartUpload onLoadPdfCart={handleLoadPdfCart} />

            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload rules and cart items to calculate
            </div>
          )}
        </div>

        {checkout && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={RESULTS_COLUMNS} rows={checkout.items} />

            <div style={S.summaryBlock}>
              <div style={S.summaryLine}>
                <span>Cart Total before offer</span>
                <strong>Rs.{checkout.subtotal.toLocaleString('en-IN')}</strong>
              </div>

              {checkout.cartOffer && (
                <div style={S.cartOfferLine}>
                  <span>{checkout.cartOffer.label}</span>
                  <span>-Rs.{checkout.cartOffer.discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div style={S.totalRow}>
                <span style={S.totalLabel}>Final Cart Total</span>
                <span style={S.totalValue}>
                  Rs.{checkout.finalTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
