import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://ypvfpwdenpdllegycwod.supabase.co',
  'sb_publishable_qjsAnFGUAX8W5x12eKwRqA_AmFJTRiE'
)

export const ADMIN_EMAIL = 'emilio.lonas@gmail.com'
