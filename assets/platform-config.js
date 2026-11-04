/* =====================================================================
   Fika med Maria — student platform settings (public by design).
   Loaded before account.js. The publishable key can only do what the
   database rules (RLS) allow. checkoutEnabled stays false until Maria
   says "go": with false, every "Купити" button answers "disabled".
   ===================================================================== */
window.FMM_PLATFORM = {
  supabaseUrl: "https://svgqvvctlujameejtqnm.supabase.co",
  supabaseKey: "sb_publishable_rOBXp5RLteSyp9pHlX7EOA_5a09VsA0", // public by design
  functionsUrl: "https://svgqvvctlujameejtqnm.supabase.co/functions/v1",
  checkoutEnabled: false,   // true only at launch (Maria's go)
  // The real site's addresses. Anywhere else (preview links, local files) the
  // cabinet runs on sample data. Add the custom domain here when it is connected.
  liveHosts: ["fikamedmaria.vercel.app"],
  supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"
};
