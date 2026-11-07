# Kolo: ajo without borders

**Kolo lets a savings circle (ajo / esusu / adashe) run across countries.** Each member pays in their own currency, and each month the whole pot pays out to one member in *their* currency. Blaaiz handles the rates, fees and the cross-border payout, and everyone can see the status live.

> Built for the Blaaiz Buildathon (GDG Ilorin), 7 Nov 2026.

## The problem
Millions of Nigerians run ajo circles. When the family is spread across London, Toronto, Houston and Lagos, the circle falls apart: someone fronts the money, someone "knows a guy" for FX, and nobody can see where the pot is. Kolo fixes that.

## User journey
1. **The circle**: 4 members, 3 countries, a $200 share each, and a rotation that sets who collects each month.
2. **Contribute**: each member taps *Pay in GBP / CAD / NGN / USD* and gets a live quote (rate, Blaaiz fee, exact amount that lands in the pot) before paying.
3. **Release the pot**: once everyone has paid, the pot is quoted into the recipient's currency (USD → NGN) and a payout to their bank account is created.
4. **Track**: the status moves from Created → Pending → Processing → Successful, and the rotation moves on to the next member.
5. **Under the hood**: a panel lists every Blaaiz call the app made, so you can see the integration.

## Blaaiz integration
All calls run server-side (`/api/*` serverless functions). Keys never reach the browser.

| Kolo action | Blaaiz endpoint |
|---|---|
| Auth | `POST /oauth/token` (client credentials) or legacy API key |
| Contribution & payout quotes | `POST /api/external/fees/breakdown` |
| Release pot | `POST /api/external/payout` (`wallet_id`, `customer_id`, `bank_transfer`, `from/to_currency_id`, `from_amount`, `merchant_reference`) |
| Track status | `GET /api/external/transaction/{id}` |

See [`api/_lib/blaaiz.js`](api/_lib/blaaiz.js).

### Mock mode (clearly labelled)
With no sandbox keys set, the server returns simulated responses with the same shapes, and the UI shows a **"Mock mode · Blaaiz API simulated"** badge. The rates are indicative. The mock fee follows the 1.5% `our_fee` in Blaaiz's fees breakdown example. To use the real API, add your keys and nothing else changes.

## Run it
```bash
npm install
cp .env.example .env   # optional: add Blaaiz sandbox keys
npm run dev            # http://localhost:5173
```
Deploy: import the repo into Vercel and add the same env vars in Project Settings. `/api` deploys as serverless functions automatically.

## Next steps
- Collections through Blaaiz virtual bank accounts and Interac, so contributions are real money in
- Webhooks (`X-Blaaiz-Signature`) in place of polling
- Invite links, missed-payment reminders, and a vote before the pot is released
