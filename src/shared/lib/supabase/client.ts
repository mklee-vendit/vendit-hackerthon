import { createClient } from '@supabase/supabase-js';
import { parseSupabaseEnv } from './env';

const { url, key } = parseSupabaseEnv(import.meta.env);

// TODO: 스키마가 잡히면 `bunx supabase gen types typescript` 결과를 제네릭으로 넘긴다.
export const supabase = createClient(url, key);
