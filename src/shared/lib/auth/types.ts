/** 요구사항 §8 의 `User`. 스키마가 커지면 `supabase gen types typescript` 결과로 대체한다. */
export type Profile = {
  id: string;
  email: string;
  display_name: string;
};
