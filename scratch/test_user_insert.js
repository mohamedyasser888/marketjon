const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://uhkvuukfuxikhfrvrqgb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eESnL7-A6GurOSziLPtowg_PtCkx10j";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'malakahm55@gmail.com',
    password: 'cuake7A9YArAFCF'
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const user = authData.user;
  console.log(`Signed in successfully as ${user.email} (ID: ${user.id})`);

  console.log("Attempting to insert a text message...");
  const { data: insertData, error: insertError } = await client
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: null,
      sender_name: 'EllJon55',
      content: 'Test message from scratch script'
    })
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
  } else {
    console.log("Insert success!", insertData);
  }
}

runTest();
