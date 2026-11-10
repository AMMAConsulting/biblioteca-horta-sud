// Configuración del proyecto Supabase (la clave publicable es pública por diseño; la seguridad está en RLS)
window.CONFIG = {
  url: "https://vbgvoarxdynredspzuxr.supabase.co",
  clave: "sb_publishable_EdYQrJVIMMRcNxlh6fylqg_sKnYLTJL",
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

// ---------- Contador global de preguntas y consumo ----------
window.fmt = (n, d = 0) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: d });
window.energia = (wh) => wh >= 1000 ? `${fmt(wh / 1000, wh >= 10000 ? 0 : 1)} kWh` : `${fmt(wh, wh >= 10 ? 0 : 1)} Wh`;
window.agua = (ml) => ml >= 1000 ? `${fmt(ml / 1000, ml >= 10000 ? 0 : 1)} L` : `${fmt(ml, ml >= 10 ? 0 : 1)} mL`;
window.equivalenciaLuz = (wh) => {          // bombilla LED de 10 W
  const min = wh / 10 * 60;
  return min < 60 ? `${fmt(min, min < 10 ? 1 : 0)} min` : min < 2880 ? `${fmt(min / 60, 1)} h` : `${fmt(min / 1440, 0)} días`;
};
window.equivalenciaAgua = (ml) => ml < 250 ? `${fmt(ml / 0.05, 0)} gotas` : `${fmt(ml / 250, ml < 2500 ? 1 : 0)} vasos`;

window.cargarEstadisticas = async () => {
  const { data, error } = await sb.rpc("estadisticas");
  return error ? null : data;
};
