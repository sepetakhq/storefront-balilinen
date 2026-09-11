# Bali Linen storefront — live e2e checklist (Chrome)

Run with the `claude-in-chrome` skill against real servers. Every case is a
buyer-visible behaviour of `http://balilinen.localhost:5175`; the driver
commands below put the backend into the state the case needs. Lily Alora on
`http://localhost:5173` is the control: after every backend mutation reload it
once and confirm nothing changed there.

## Setup

```bash
cd backend && make up && make seed && make accounts && make api     # own worktree ports/DBs
npm run dev:balilinen                                                # :5175
npm run dev                                                          # :5173 (control)
```

- Mailhog `http://localhost:8025` for OTP codes and order emails.
- Admin API: `POST /api/v1/admin/session` with `Host: localhost:5184`
  `{email: admin@lilyalora.local, password: lilyalora-dev}` → cookie +
  `csrf_token`; mutate with `X-CSRF-Token`. Tenant path is
  `/api/v1/admin/tenants/balilinen/...` (`PATCH settings`, `PATCH products/:id`,
  `POST orders/:id/status`, `PATCH orders/:id/awb`, `POST promotions`).
- Stub payment webhook: `POST /webhooks/stub/balilinen`
  `{event_id, reference, status: "paid"|"expired"|"failed", amount, signature}`,
  `signature = hex(hmac_sha256(PAYMENT_STUB_SECRET, "ref|status|amount"))`.
  `reference` is the intent reference in the admin order detail.
- Chrome caveats: `*.localhost` resolves natively; never open Bali on
  `localhost`. Never click the WhatsApp FAB/links (opens a foreign tab). Use
  the mouse for "Copy" buttons — the JS tool blocks clipboard/cookie output.
- Reset between runs: clear `localStorage` for the origin (cart, device orders).
- **Hidden automation window:** TanStack pauses retries and polling while
  `document.visibilityState` is `hidden`, so the gate's retry (0.3) and the
  order page's poll (6.7) look stuck. Import the app's own
  `@tanstack_react-query.js?v=<hash>` (URL from the network tab) and call
  `focusManager.setFocused(true)` once per page load, or keep the window
  visible.
- A verified buyer is trusted on the device for a while: the second checkout
  shows "Place order" with no OTP. Clear `localStorage` to get the modal back.

Mark each case ✅ / ❌ with the order number or screenshot name.

## 0. Shell and gate

| # | Case | Expect |
|---|---|---|
| 0.1 | First load, cold cache | Marcellus/Karla, cream palette, English copy, `<title>` and OG head from `/storefront/config` (view-source), no console errors |
| 0.2 | `/api/v1/storefront/config` on this host | `brand.template = "balilinen"`, `order_prefix` "BL", couriers jne/jnt/sicepat/anteraja, methods BCA/QRIS/GOPAY/MANUAL_BCA (the design demo; MANUAL_QRIS off until a QR is uploaded) |
| 0.3 | API down (kill api, reload) | Loading shimmer → "store unavailable" state with a working Retry; Retry after `make api` recovers without a full reload |
| 0.4 | Tenant unknown (`http://nope.localhost:5175`) | "Storefront not found" — not the Bali or Lily bundle |
| 0.5 | Announcement bar | Text from config; hides when admin PATCH sets it empty (cache ≤60s / invalidated on PATCH) |
| 0.6 | Header nav from config | Shop all / Our story / Track order → `/katalog`, `/tentang`, `/lacak` (logo is home, as designed); cart badge follows cart |
| 0.7 | Footer | Address, payment method list, shipping copy, track link; no Indonesian leaks |
| 0.8 | WhatsApp FAB | Gated by `brand.whatsapp_url`, not the contact channel. PATCH it to `""` → FAB and footer line gone; restore → back (do not click) |
| 0.9 | Update banner | Rebuild + serve embedded while a tab is open → banner offers reload; reload picks new bundle |
| 0.10 | Viewports 390px and 1440px | No horizontal scroll, sticky cart bar, nav collapses, tiles wrap |
| 0.11 | Keyboard | Tab order header → product → checkout form; focus visible; Esc closes OTP modal |
| 0.12 | Unknown route `/foo` | 404 screen with link home; `/track/<token>` redirects to `/pesanan/<token>` |

## 1. Home `/`

| # | Case | Expect |
|---|---|---|
| 1.1 | Sections in `/storefront/home` order | hero (eyebrow, title with em, 2 CTAs, 3 stats, photo), Shop by room (photo tiles), "Mid-year linen sale −10%" campaign with countdown and 4 cards, "Trending now" grid (6 `trending`), dark hospitality banner with a WhatsApp CTA, story with photo |
| 1.2 | Hero photo | Seeded `hero_images[0]` renders with srcset; with it cleared via admin the hero renders a placeholder tile, no layout jump |
| 1.3 | Grid with <6 trending | Untag `trending` via admin → grid shows fewer, hides entirely at 0 (no orphan heading) |
| 1.4 | Category tile → `/katalog?cat=…` | Filter chip preselected |
| 1.5 | Home content emptied | PATCH content to no sections → shell still renders, no crash |

## 2. Catalogue `/katalog`

| # | Case | Expect |
|---|---|---|
| 2.1 | Chips Bedroom / Bathroom / Homewares / All | List filters, URL updates, back button restores chip |
| 2.2 | Paging | Add products past the page size → "Load more" appends without duplicates; hides at the end |
| 2.3 | Empty category | Category with 0 products → English empty state with link to all |
| 2.4 | Price | `Rp 350.000`; with a promotion: strike + sale price |
| 2.5 | Sold-out card | Stock 0 via admin → badge, card still opens |
| 2.6 | Hidden product | `active=false` → gone from list; direct `/produk/:slug` → 404 screen |
| 2.7 | Sort by price | Orders by discounted price, not list price |

## 3. Product `/produk/:slug`

| # | Case | Expect |
|---|---|---|
| 3.1 | Normal | Placeholder thumbs, qty stepper, Add to cart, tabs (details/care/shipping), related from same category; "Ask on WhatsApp" only when channel = whatsapp |
| 3.2 | Qty bounds | Not below 1, not above stock; typed 999 clamps |
| 3.3 | Stock 0 | Add disabled, English "Sold out" note |
| 3.4 | Low stock | "Only N left" note at threshold |
| 3.5 | Pre-order product | Set pre-order fields via admin → note with lead time; add allowed; cart line shows pre-order |
| 3.6 | Availability window | Before: note + disabled; inside: normal; after: closed note. Use dates around now |
| 3.7 | Unknown slug | 404 screen, not blank |
| 3.8 | Add same product twice | Line qty merges, one toast per add |
| 3.9 | Back/forward | Scroll restores, cached query, no spinner |

## 4. Cart `/keranjang`

| # | Case | Expect |
|---|---|---|
| 4.1 | Empty | Empty state with CTA to shop |
| 4.2 | Lines | Qty +/−, remove, subtotal; shipping is "Calculated at checkout" (no free-shipping meter in this design — the threshold shows on the product page and checkout) |
| 4.3 | Price changed server-side | Admin PATCH price while cart open → reload shows the new price silently; the "changed" banner appears only when the checkout bounces the cart back |
| 4.4 | Stock below qty | Stock 1 with qty 2 → "Only 1 left. Adjust to 1"; the button fixes the line; checkout stays enabled (the server refuses an over-stock draft) |
| 4.5 | Product deactivated | Line flagged unavailable, remove offered, checkout blocked |
| 4.6 | Mixed pre-order + stock | Order note: whole order ships on the pre-order date |
| 4.7 | Persistence | Reload and new tab keep the cart; `localhost:5173` has its own cart |
| 4.8 | Stale cart shape | Seed localStorage with a line lacking new fields → no crash; line dropped or repaired |

## 5. Checkout `/checkout`

### Form
| # | Case | Expect |
|---|---|---|
| 5.1 | Required fields | Inline English errors; first error focused |
| 5.2 | Phone forms | `0812…`, `+62812…`, `62812…` accepted; letters rejected |
| 5.3 | Email invalid | Error; valid continues |
| 5.4 | Destination (flat mode, seed) | Picker matches `shipping.mode`; flat fee per courier |
| 5.5 | Destination (live mode) | PATCH `shipping.mode=live` → search debounce, no-results state, select → rates; rate API error → retry, not stuck |
| 5.6 | Couriers | Only jne/jnt/sicepat/anteraja; free shipping when subtotal ≥ 750.000 |
| 5.7 | Payment methods | Only enabled ones, fee shown; disabling via admin removes it; a platform route switched off → method absent/suspended, never a broken button |
| 5.8 | Method limits | Amount outside min/max → method disabled with reason |
| 5.9 | Promo code | Valid → discount line; invalid/expired → English error |
| 5.10 | Empty cart direct hit | `/checkout` redirects to cart |

### Review (server-priced)
| # | Case | Expect |
|---|---|---|
| 5.11 | Totals from server | Subtotal, shipping, fee, discount, total equal the API quote; no client-computed total |
| 5.12 | Price change on review | The review is a held quote (30 min): a price changed underneath is honoured at the reviewed price; a stock change is what bounces the buyer back to the cart |
| 5.13 | Stock gone at confirm | Stock 0 at review → error with link to cart, no order created |
| 5.14 | Edit step | Back to form keeps every field |

### OTP
| # | Case | Expect |
|---|---|---|
| 5.15 | Send | Modal opens; email in Mailhog; nothing sent before the click |
| 5.16 | Wrong code | One generic English error; field cleared |
| 5.17 | Expired code | Same generic error |
| 5.18 | Too many attempts | 3× wrong → same generic error; Resend is the only way out |
| 5.19 | Resend cooldown | Disabled with countdown; old code fails after resend, new works |
| 5.20 | Code from another checkout | Tab A's code in tab B → generic error |
| 5.21 | Cancel modal | Back to review, state intact |
| 5.22 | Double submit | Rapid double click Verify → exactly one order in admin |
| 5.23 | Success | `/pesanan/:token`; `track_token` never appears again in any response (network tab); Mailhog order email links to `http://balilinen.localhost/track/…` |

## 6. Order `/pesanan/:token` — payment panel

Enable the method in settings, place an order, drive with the stub webhook.

| # | Kind | Expect |
|---|---|---|
| 6.1 | `qr` (QRIS stub) | QR, "test mode" label, countdown from `expires_at`, amount with copy |
| 6.2 | `qr_image` | Image renders; broken URL → fallback text, not blank |
| 6.3 | `va` (BCA / Mandiri) | Bank, VA number, copy, amount, instructions |
| 6.4 | `manual_transfer` (MANUAL_BCA) | Merchant account from config; "I've paid" → awaiting confirmation; second claim disabled; admin confirm-payment → paid |
| 6.5 | `manual_qris` | Static QR + claim flow |
| 6.5a | `manual_whatsapp` (MANUAL_WHATSAPP) | Message preview in English, "Open WhatsApp →" is a `wa.me/<number>?text=` link with the order inside, no unique code on the amount, "I've paid" → held; admin confirm-payment → paid |
| 6.6 | `redirect` | Opens gateway URL same tab; return lands on order page |
| 6.7 | Webhook `paid` | Panel flips to paid without reload; timeline gains Paid; `status_label` from API |
| 6.8 | Webhook `expired` | Dead state ("Payment couldn’t be opened"); "Try payment again" reopens the **same** method with a fresh reference |
| 6.9 | Webhook `failed` | Same as 6.8 |
| 6.10 | Retry keeps the method | `reopenPayment` takes no body — there is no method switch after checkout; old VA/QR gone, new one shown |
| 6.11 | Order `expired` (admin) | Panel hidden, product stock restored |
| 6.12 | Order `cancelled` (admin) | Cancelled tone, no panel, restock |
| 6.13 | `processing → shipped` + AWB | AWB, courier, tracking link; `shipped → completed` tone |
| 6.14 | Illegal transition | Admin `awaiting_payment → shipped` → 409; storefront unchanged |
| 6.15 | Order vs payment disagree | Order cancelled, intent paid → order status wins |
| 6.16 | Bad token | `/pesanan/garbage` → not-found state |
| 6.17 | Lily token on Bali host | Not found (tenant scoped) |
| 6.18 | Timeline | From `order.timeline` only |
| 6.19 | Paid email | Mailhog, Bali sender name, English? (API emails may stay Indonesian — note which) |

## 7. Track `/lacak`

| # | Case | Expect |
|---|---|---|
| 7.1 | Device orders | This browser's orders newest first; gone after clearing localStorage |
| 7.2 | Paste token | Valid → order; invalid → error |
| 7.3 | OTP lookup by email | Send → Mailhog → verify → that email's orders; wrong code generic; cooldown |
| 7.4 | Email with no orders | Empty state |
| 7.5 | Lily buyer email on Bali host | No Lily orders leak |

## 8. About and SEO

| # | Case | Expect |
|---|---|---|
| 8.1 | `/tentang` | English story from config, no portrait with empty `HeroImages` |
| 8.2 | `/sitemap.xml`, `/robots.txt` | Bali paths and host |
| 8.3 | Product OG (`curl -H 'Host: balilinen.localhost'`) | title/description/og:image; `og:locale` still `id_ID` (known) |

## 9. Tenant switching and isolation

| # | Case | Expect |
|---|---|---|
| 9.1 | PATCH `brand.template=""` | Bali host serves root (Cormorant) bundle immediately; PATCH back restores (embedded binary) |
| 9.2 | PATCH `brand.template="nope"` | 400 "Unknown storefront template." |
| 9.3 | Cross-host asset | Bali hashed asset on `localhost` → 404 (embedded binary) |
| 9.4 | Backoffice | `merchant@balilinen.local` sees only balilinen; `admin@` both; Bali orders absent from Lily's list |
| 9.5 | Two tabs, two tenants | Cart and device orders independent per origin |

## 10. Resilience

| # | Case | Expect |
|---|---|---|
| 10.1 | Offline mid-checkout | English network error; retry works when back |
| 10.2 | DB down (`docker stop backend-postgres-1`) | Error states, no white page |
| 10.3 | Slow 3G throttle | Skeletons; no refetch storm (network tab) |
| 10.4 | API restart | Stub forgets references; order page still renders from DB; poll degrades |
| 10.5 | Long names / prices ≥ Rp 10.000.000 | No overflow in card, cart, review |

## Reporting

Attach order numbers per payment kind, screenshots for 0.10, 3.x, 6.x, Mailhog
message IDs, and console/network capture for every ❌. A ❌ is a diagnosis,
not a patch (CLAUDE.md rule 10).

## Run 2026-09-11 (dev servers, worktree DB, Chrome)

Orders: BL-260911-0002 (QRIS → webhook paid → shipped, AWB JNE123456789),
0003 (VA BCA → webhook failed → retry → cancelled, stock restored 37→38),
0004 (manual transfer → "I’ve paid" claim → admin confirm → processing).

Passed: 0.1–0.8, 0.10 (after fix), 0.11 (focus ring only), 0.12; 1.1–1.4;
2.1, 2.2, 2.3, 2.5, 2.6; 3.1–3.6, 3.8; 4.1, 4.4, 4.5, 4.6, 4.7; 5.1 (one
summary error, no field focus — same as Lily), 5.2, 5.3, 5.4, 5.6, 5.7, 5.9,
5.11, 5.15–5.19, 5.22, 5.23; 6.1, 6.3, 6.4, 6.7, 6.9, 6.12, 6.13, 6.14, 6.16,
6.17; 7.1–7.3; 8.2, 8.3; 9.4; 10.5. 9.1–9.3 passed on the embedded binary in
the earlier session. 4.3 and 5.12 were observed and their expectations
rewritten above.

Not run: 0.9 (needs an embedded rebuild mid-session), 1.5, 2.4, 2.7, 3.7, 3.9,
4.8, 5.5 (live rates need RajaOngkir credentials), 5.8, 5.10, 5.13, 5.14,
5.20, 5.21, 6.2/6.5/6.6 (no `qr_image` / `manual_qris` / `redirect` route in
the dev routing table), 6.8 (only `failed` was sent), 6.11, 6.15, 6.19, 7.4,
7.5, 8.1, 9.5, 10.1–10.4 (offline, DB-down and throttling not driven from the
extension).

Fixed in the template during the run:
- Mobile header stacked the four nav links beside the logo (sticky header
  ~160px tall at 390px). Nav is now its own scrollable row under 640px.
- "Couldn’t reach the shop" rendered the client's Indonesian 5xx fallback;
  body is now a fixed English line.
- OTP failures (checkout and lookup) rendered the API's Indonesian 400
  message; the template owns `OTP_INVALID` since that 400 is one
  indistinguishable case by design.

Still Indonesian in an English shop, all API-side and not changed here:
`payment.Describe` method blurbs on checkout and footer ("Transfer manual,
dicek penjual"), `order.status_label` and `order.timeline` labels
("MENUNGGU PEMBAYARAN", "Diproses"), promo-code errors ("Kode … tidak
dikenal"), 429 waits, and every email subject/body. Decide between a `lang`
on the tenant honoured by the API, or English twins keyed by method/status
code in the template.
