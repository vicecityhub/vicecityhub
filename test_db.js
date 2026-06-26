import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpglkglhjdqnktybksth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk';

const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const types = ['news', 'forum', 'domain', 'stream', 'podcast'];
  for (const t of types) {
    const { data, error } = await supa.from('posts').select('*').eq('type', t);
    if (error) {
      console.error(`Error fetching type ${t}:`, error);
    } else {
      console.log(`Type ${t} count:`, data.length);
      if (data.length > 0) {
        console.log(`Sample ${t}:`, JSON.stringify(data.slice(0, 2), null, 2));
      }
    }
  }
}

test();
