const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cwpklutxwxtaadcbnzkm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGtsdXR4d3h0YWFkY2JuemttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4MDk3MjEsImV4cCI6MjA1ODM4NTcyMX0.8MGuRx__XIozbpMuATkm282YJOEYkoVDd-5SHv7I558';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
