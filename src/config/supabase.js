import { createClient } from '@supabase/supabase-js'

// Configuration manuelle - remplace avec TES valeurs
const supabaseUrl = 'https://kefuqydrgxhgxvtyrqha.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZnVxeWRyZ3hoZ3h2dHlycWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDYzODcsImV4cCI6MjA3ODM4MjM4N30.ISoS3h5cOuoYUSdCDiK4l5Lw7-N7ai46DBk2jzedBM4' // COLLE TA NOUVELLE CLÉ DIRECTEMENT ICI

console.log('🔗 Configuration Supabase:');
console.log('URL:', supabaseUrl);
console.log('Clé présente:', !!supabaseKey);

export const supabase = createClient(supabaseUrl, supabaseKey)

// Test de connexion au chargement
supabase.from('employes').select('count').limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Erreur connexion Supabase:', error)
    } else {
      console.log('✅ Connexion Supabase établie')
    }
  })