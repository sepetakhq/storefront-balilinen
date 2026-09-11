import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';

import RootLayout from './RootLayout.jsx';
import HomeRoute from './screens/HomeRoute.jsx';
import CatalogRoute from './screens/CatalogRoute.jsx';
import ProductRoute from './screens/ProductRoute.jsx';
import CartRoute from './screens/CartRoute.jsx';
import CheckoutRoute from './screens/CheckoutRoute.jsx';
import OrderRoute from './screens/OrderRoute.jsx';
import LookupRoute from './screens/LookupRoute.jsx';
import About from './screens/About.jsx';
import NotFound from './screens/NotFound.jsx';

/**
 * The same ten paths as src/routes.jsx, and not by choice: the backend bakes
 * them into confirmation emails (`/track/:token`), the gateway return
 * (`/lacak`), the sitemap and the SEO classifier, which answers HTTP 404 for
 * any path it does not know. backend/internal/seo/routes_drift_test.go reads
 * this file to hold it to that.
 */
function TrackRedirect() {
  const { token } = useParams();
  return <Navigate to={`/pesanan/${token}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'katalog', element: <CatalogRoute /> },
      { path: 'produk/:slug', element: <ProductRoute /> },
      { path: 'keranjang', element: <CartRoute /> },
      { path: 'checkout', element: <CheckoutRoute /> },
      { path: 'pesanan/:token', element: <OrderRoute /> },
      { path: 'track/:token', element: <TrackRedirect /> },
      { path: 'lacak', element: <LookupRoute /> },
      { path: 'tentang', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
