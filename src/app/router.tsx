import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { previewRoutes } from '@/pages/preview/previewRoutes';
import { ResultsRoute } from '@/pages/results/ResultsRoute';
import { SearchRoute } from '@/pages/search/SearchRoute';
import { RequireMember } from './RequireMember';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireMember>
        <SearchRoute />
      </RequireMember>
    ),
  },
  {
    path: '/results',
    element: (
      <RequireMember>
        <ResultsRoute />
      </RequireMember>
    ),
  },
  ...previewRoutes,
]);
