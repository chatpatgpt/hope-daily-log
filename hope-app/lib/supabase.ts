import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type LogType = 'walk' | 'accident';
export type LogSubtype = 'pee' | 'poop';

export interface HopeLog {
  id: string;
  type: LogType;
  subtype?: LogSubtype;
  person: string;
  user_id: string;
  user_email?: string;
  duration?: number;
  pooped?: boolean;  // For walks: did Hope poop outside?
  peed?: boolean;    // For walks: did Hope pee outside?
  created_at: string;
}
