import { useState } from 'react'
import { parseNaturalLanguageRule } from '../parsers/nlRuleParser.js'

const S = {
  wrap: { marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid #e5e5e5' },
  label: { fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 6 },
  form: { display: 'flex', gap: 8 },
  input: {
    flex: 1, padding: '0.5rem 0.65rem', fontSize: 12, border: '1px solid #CECECE',
    borderRadius: 4, outline: 'none',
  },
  keyInput: {
    width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '0.4rem 0.6rem',
    fontSize: 11, border: '1px solid #CECECE', borderRadius: 4,
  },
  btn: {
    background: '#131A48', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.5rem 0.9rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.5rem 0.9rem', fontSize: 12, fontWeight: 700, cursor: 'not-allowed',
  },
  error: {
    marginTop: 8, padding: '0.55rem 0.75rem', background: '#fff4f2',
    border: '1px solid #f0b8b0', borderRadius: 4, fontSize: 12, color: '#9e2a2b',
  },
  confirmCard: {
    marginTop: 8, padding: '0.75rem', background: '#f7f8fc',
    border: '1px solid #131A48', borderRadius: 4, fontSize: 12,
  },
  confirmTitle: { fontWeight: 700, color: '#131A48', marginBottom: 6 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 10 },
  actions: { display: 'flex', gap: 8 },
  confirmBtn: {
    background: '#1e5c2c', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.45rem 0.85rem', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  discardBtn: {
    background: '#fff', color: '#555', border: '1px solid #CECECE', borderRadius: 4,
    padding: '0.45rem 0.85rem', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
}

export default function NaturalLanguageRuleInput({ existingRuleIds, onAddRule }) {
  const [text, setText] = useState('')
  const [sessionKey, setSessionKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingRule, setPendingRule] = useState(null)

  const hasEnvKey = Boolean(import.meta?.env?.VITE_LLM_API_KEY)

  async function handleParse(e) {
    e.preventDefault()
    setError(null)
    setPendingRule(null)
    setLoading(true)

    const res = await parseNaturalLanguageRule(
      text,
      existingRuleIds,
      sessionKey.trim() ? { apiKey: sessionKey.trim() } : {}
    )
    setLoading(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    setPendingRule(res.rule)
  }

  function handleConfirm() {
    if (!pendingRule) return
    onAddRule(pendingRule)
    setPendingRule(null)
    setText('')
    setError(null)
  }

  return (
    <div style={S.wrap}>
      <div style={S.label}>Add Rule in Plain English</div>
      <form onSubmit={handleParse} style={S.form}>
        <input
          type="text"
          style={S.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "20% off for Natura Casa brand, stackable"'
          disabled={loading}
        />
        <button
          type="submit"
          style={loading || !text.trim() ? S.btnDisabled : S.btn}
          disabled={loading || !text.trim()}
        >
          {loading ? 'Parsing...' : 'Parse'}
        </button>
      </form>

      {!hasEnvKey && (
        <input
          type="password"
          style={S.keyInput}
          value={sessionKey}
          onChange={(e) => setSessionKey(e.target.value)}
          placeholder="OpenAI API key (session-only, or set VITE_LLM_API_KEY in env)"
        />
      )}

      {error && <div style={S.error} role="alert">{error}</div>}

      {pendingRule && (
        <div style={S.confirmCard}>
          <div style={S.confirmTitle}>Confirm Parsed Rule ({pendingRule.ruleId})</div>
          <div style={S.grid}>
            <div><strong>Scope:</strong> {pendingRule.scope}</div>
            <div><strong>Applies to:</strong> {pendingRule.appliesTo}</div>
            <div><strong>Type:</strong> {pendingRule.type}</div>
            <div>
              <strong>Value:</strong>{' '}
              {pendingRule.type === 'percentage'
                ? `${pendingRule.value}% off`
                : `Rs.${pendingRule.value.toLocaleString('en-IN')} off`}
            </div>
            {pendingRule.scope === 'cart' && (
              <div>
                <strong>Min Cart Value:</strong> Rs.{pendingRule.minCartValue.toLocaleString('en-IN')}
              </div>
            )}
            <div><strong>Stackable:</strong> {pendingRule.stackable ? 'Yes' : 'No'}</div>
          </div>
          <div style={S.actions}>
            <button type="button" style={S.confirmBtn} onClick={handleConfirm}>
              Confirm &amp; Add Rule
            </button>
            <button type="button" style={S.discardBtn} onClick={() => setPendingRule(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
