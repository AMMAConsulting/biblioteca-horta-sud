import { createClient } from "npm:@supabase/supabase-js@2";

export const MUNICIPIOS = [
  "Toda la comarca",
  "Alaquàs", "Albal", "Alcàsser", "Aldaia", "Alfafar", "Benetússer", "Beniparrell",
  "Catarroja", "Llocnou de la Corona", "Manises", "Massanassa", "Mislata", "Paiporta",
  "Picanya", "Picassent", "Quart de Poblet", "Sedaví", "Silla", "Torrent", "Xirivella",
];

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
