import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { previewRoutes } from '@/pages/preview/previewRoutes';
import { RestaurantRoute } from '@/pages/restaurant/RestaurantRoute';
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
  {
    path: '/restaurants/:restaurantId',
    element: (
      <RequireMember>
        <RestaurantRoute />
      </RequireMember>
    ),
  },
  ...previewRoutes,
]);
