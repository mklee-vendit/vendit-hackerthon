import type { RouteObject } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { LoginView } from '@/pages/login/LoginView';
import {
  PREVIEW_COLLECTION_NOTE,
  PREVIEW_CONDITIONS,
  PREVIEW_DISPLAY_NAME,
  PREVIEW_RESTAURANTS,
} from '@/pages/results/fixtures';
import { ResultsPage } from '@/pages/results/ResultsPage';
import { SearchPage } from '@/pages/search/SearchPage';

/** 추천픽 개수 — docs/venparty.md §6 ⚠️ 잠정. 목업 기본값 3. */
const PREVIEW_PICK_COUNT = 3;

function SearchPreview() {
  const navigate = useNavigate();
  return (
    <SearchPage
      displayName={PREVIEW_DISPLAY_NAME}
      collectionNote={PREVIEW_COLLECTION_NOTE}
      onSubmit={() => navigate('/preview/results')}
    />
  );
}

function ResultsPreview() {
  const navigate = useNavigate();
  return (
    <ResultsPage
      displayName={PREVIEW_DISPLAY_NAME}
      conditions={PREVIEW_CONDITIONS}
      restaurants={PREVIEW_RESTAURANTS}
      pickCount={PREVIEW_PICK_COUNT}
      onEditConditions={() => navigate('/preview/search')}
    />
  );
}

/**
 * 디자인 확인용 라우트 — 로그인 없이 열린다. 기능 연결이 끝나면 이 파일과 fixtures 를 지운다.
 * TODO: 실제 라우트로 옮긴 뒤 삭제
 */
export const previewRoutes: RouteObject[] = [
  {
    path: '/preview/login',
    element: (
      <LoginView
        onGoogleClick={() => {}}
        error="jieun.kim@gmail.com 은 회사 계정이 아니에요. @vendit.co.kr 계정으로 다시 시도해주세요."
      />
    ),
  },
  { path: '/preview/search', element: <SearchPreview /> },
  { path: '/preview/results', element: <ResultsPreview /> },
];
