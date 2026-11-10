// Configuración del proyecto Supabase (la clave publicable es pública por diseño; la seguridad está en RLS)
window.CONFIG = {
  url: "PENDIENTE_URL_SUPABASE",
  clave: "PENDIENTE_CLAVE_PUBLICABLE",
};

window.MUNICIPIOS = [
  "Toda la comarca",
  "Alaquàs", "Albal", "Alcàsser", "Aldaia", "Alfafar", "Benetússer", "Beniparrell",
  "Catarroja", "Llocnou de la Corona", "Manises", "Massanassa", "Mislata", "Paiporta",
  "Picanya", "Picassent", "Quart de Poblet", "Sedaví", "Silla", "Torrent", "Xirivella",
];

window.sb = window.supabase.createClient(CONFIG.url, CONFIG.clave);

window.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

window.rellenarMunicipios = (select, primero) => {
  select.innerHTML = (primero ? `<option value="">${primero}</option>` : "") +
    MUNICIPIOS.map((m) => `<option>${esc(m)}</option>`).join("");
};

// Lee el mensaje de error que devuelve una función de Supabase
window.errorDe = async (error) => {
  try { const j = await error.context.json(); if (j?.error) return j.error; } catch (_) { /* nada */ }
  return "Ha habido un problema de conexión. Inténtalo de nuevo.";
};
