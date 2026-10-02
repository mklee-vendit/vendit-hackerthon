import { useContext } from 'react';
import {
  SessionContext,
  type SessionState,
} from '@/app/providers/auth/AuthProvider';

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) {
    throw new Error('useSession: <AuthProvider> 안에서만 쓸 수 있습니다.');
  }
  return state;
}
