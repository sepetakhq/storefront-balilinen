# storefront-balilinen

Bali Linen's storefront: the screens, components, styles and English copy
(`src/lib/copy.js`). Everything that is not a design — API client, tenant
config, cart, checkout state, the helpers that decide what a page may say —
comes from [`@sepetakhq/storefront-kit`](https://www.npmjs.com/package/@sepetakhq/storefront-kit).

## Develop

Run the platform API first (`make up && make seed && make api` in the
`platform` checkout), then:

```
npm install
npm run dev          # http://balilinen.localhost:5175, /api proxied to the API on :8090
```

Open it on `balilinen.localhost`, not `localhost`: the API resolves the shop
from the Host header and that is the domain the seed installs this tenant
on. `API_TARGET` and `DEV_PORT` override the proxy target and port. The
document head is filled from the API by the kit's `seoDevPlugin`.

## Ship

Every push to `main` builds and uploads to the template registry
(`.github/workflows/release.yml`); the API serves the new build within a
minute. To see the registry path locally, publish to the dev MinIO:

```
npm run publish:local
open http://balilinen.localhost:8090/
```

## Rules

- Serve exactly the kit's `ROUTE_CONTRACT` (`src/routes.test.js` pins it).
- Keep the `<!--seo:start-->` / `<!--seo:end-->` markers in `index.html`.
- English copy lives in `src/lib/copy.js` and wraps the kit's decision
  helpers; the kit's own strings are Indonesian defaults. Branch on
  `payment.kind`, render `order.timeline`.
