import { useNavigate } from 'react-router-dom';
import { useProfile, useSession } from '@/shared/lib/auth';
import type { SearchCriteria } from '@/shared/lib/recommend';
import { useCollectionNote } from '@/shared/lib/restaurants/hooks';
import { criteriaToParams } from '@/shared/lib/search/criteria';
import { SearchPage } from './SearchPage';

/**
 * 1b 검색 화면의 실제 배선. 화면은 `SearchPage` 가, 조건을 URL 로 옮기는 일은 여기가 한다.
 */
export function SearchRoute() {
  const navigate = useNavigate();
  const session = useSession();
  const userId =
    session.status === 'signedIn' ? session.session.user.id : undefined;
  const profile = useProfile(userId);
  const note = useCollectionNote();

  const submit = (criteria: SearchCriteria) => {
    navigate(`/results?${criteriaToParams(criteria).toString()}`);
  };

  return (
    <SearchPage
      displayName={profile.data?.display_name ?? ''}
      // 수집 상태를 못 읽었으면 **빈 줄로 두지 않고** 모른다고 적는다 — 실패를 숨기지 않는다(§7).
      collectionNote={
        note.isError
          ? '수집 상태를 읽지 못했어요'
          : (note.data ?? '불러오는 중…')
      }
      onSubmit={submit}
    />
  );
}
