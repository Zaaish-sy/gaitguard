import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const RPI_URL  = import.meta.env.VITE_RPI_URL  || 'http://10.246.71.21:5000'
export const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''