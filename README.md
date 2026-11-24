# Opptra Discount Engine — FDE Intern Assignment

**Live Deployment:** https://turbzox1.github.io/discount-engine-assignment/

Customer-facing cart pricing engine supporting CSV uploads, **cart-level threshold offers**, **natural language rule creation (LLM-parsed with confirmation)**, and **PDF cart uploads**.

## Run Locally (< 3 Steps)

1. Clone and install dependencies:

   ```bash
   git clone https://github.com/turbzox1/discount-engine-assignment
   cd discount-engine-assignment && npm install
   ```

2. Start the dev server and open `http://localhost:5173`:

   ```bash
   npm run dev
   ```

*(Optional: set `VITE_LLM_API_KEY` in a `.env` file, or paste an OpenAI-compatible API key directly in the UI's session-only field to test Natural Language Rule Input.)*

## Architecture (Decoupled Input Adapters)

The core pricing engine (`src/engine/discountEngine.js`) has zero dependency on CSV, PDF, or LLM inputs. Every input path adapts to the engine's `DiscountRule` and `CartItem` schemas:

* **CSV Upload (`src/engine/csvParser.js`)** — Parses `rules.csv` (including `scope="cart"` and `min_cart_value`) and `cart.csv`.
* **Natural Language Rule Input (`src/parsers/nlRuleParser.js` + `src/components/NaturalLanguageRuleInput.jsx`)** — Sends plain English to an LLM with strict JSON output, runs deterministic validation (`validateParsedRule`), and requires user Confirm/Discard before adding the rule and re-running the cart.
* **PDF Cart Upload (`src/parsers/pdfCartParser.js` + `src/components/PdfCartUpload.jsx`)** — Extracts `Product | Brand | Platform | Base Price` tables client-side via `pdfjs-dist` coordinate clustering, replaces the cart, and re-runs automatically.

## Design Decisions & Tradeoffs

* **Client-side PDF parsing (`pdfjs-dist`) vs. backend:** Keeps the app 100% static (deployed via GitHub Pages with zero server maintenance) and keeps uploaded cart PDFs in-browser. *Tradeoff:* Works cleanly on text-based tabular PDFs (matching the assignment invoice format) but does not OCR scanned image-only PDFs; a serverless OCR/vision endpoint can drop in behind `parseCartPdfFile` without touching the engine or UI.
* **Malformed PDF rows:** Invalid rows (missing columns or unparseable prices) are skipped and surfaced in a warning banner while valid rows load cleanly. If zero valid rows are extracted, the existing cart is preserved untouched.
* **LLM validation & ambiguous inputs:** LLM output is never trusted blindly—`validateParsedRule` enforces valid scopes (`brand | platform | cart`), positive numeric bounds (`1–100%` for percentage), non-empty targets, and required `minCartValue` for cart rules. Ambiguous inputs (e.g. *"Give a discount for big orders"*) return a structured error with a concrete example instead of guessing or crashing.
* **Cart-level threshold boundary:** Cart offers evaluate strictly against the post-item-discount subtotal (`subtotal >= minCartValue`). When below threshold (e.g. `Rs.3,999 < Rs.4,000`), the cart offer row is omitted completely per spec.
* **Base repo bugfix:** Fixed a typo in base `src/App.jsx` (`setCartErr` → `setCartErrors`) so cart CSV validation errors render properly.
