import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tpvljpxsxailgyvoznqk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8KaKBud6YQCH8xsjVTw1kg_X7Qrx5pF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);