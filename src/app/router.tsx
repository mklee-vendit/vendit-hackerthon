import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { previewRoutes } from '@/pages/preview/previewRoutes';
import { RequireMember } from './RequireMember';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireMember>
        <HomePage />
      </RequireMember>
    ),
  },
  ...previewRoutes,
]);
