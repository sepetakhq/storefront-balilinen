import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { createQueryClient } from '../../../src/api/queryClient.js';
import { purgeLegacyKeys } from '../../../src/lib/storage.js';
import { router } from './routes.jsx';
import './styles.css';

purgeLegacyKeys();

const queryClient = createQueryClient();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
