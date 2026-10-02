import type { PostgrestError } from '@supabase/supabase-js';
import {
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  type SupabaseResponse,
  type Unwrapped,
  unwrapResult,
} from './supabaseResult';

/**
 * supabase 쿼리를 react-query 에 얹는다. 반환 타입은 빌더에서 추론된다 —
 * `.select()` 는 배열, `.single()` 은 객체, `.maybeSingle()` 은 `| null`.
 *
 * **빌더가 아니라 빌더를 만드는 함수**를 받는다. postgrest 빌더는 `then` 될 때 요청을
 * 보내므로, 빌더를 그대로 넘기면 react-query 가 쓰기 전에 이미 떠 있고 재시도·refetch 가
 * 같은 빌더를 다시 await 하게 된다.
 *
 * @example
 * const { data } = useSupabaseQuery(['rooms'], () =>
 *   supabase.from('rooms').select('id, name').order('name'),
 * );
 */
export function useSupabaseQuery<
  R extends SupabaseResponse,
  TData = Unwrapped<R>,
>(
  queryKey: QueryKey,
  build: () => PromiseLike<R>,
  options?: Omit<
    UseQueryOptions<Unwrapped<R>, PostgrestError, TData>,
    'queryKey' | 'queryFn'
  >,
): UseQueryResult<TData, PostgrestError> {
  return useQuery({
    queryKey,
    queryFn: async () => unwrapResult(await build()),
    ...options,
  });
}

/**
 * supabase 쓰기를 react-query 에 얹는다.
 *
 * @example
 * const { mutate } = useSupabaseMutation(
 *   (name: string) => supabase.from('rooms').insert({ name }).select().single(),
 *   { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }) },
 * );
 */
export function useSupabaseMutation<
  R extends SupabaseResponse,
  TVariables = void,
>(
  run: (variables: TVariables) => PromiseLike<R>,
  options?: Omit<
    UseMutationOptions<Unwrapped<R>, PostgrestError, TVariables>,
    'mutationFn'
  >,
): UseMutationResult<Unwrapped<R>, PostgrestError, TVariables> {
  return useMutation({
    mutationFn: async (variables: TVariables) =>
      unwrapResult(await run(variables)),
    ...options,
  });
}
