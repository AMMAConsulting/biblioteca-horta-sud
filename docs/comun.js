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
window.equivalenciaAgua = (ml) => {        // lata de refresco de 33 cl (330 mL)
  const latas = ml / 330;
  if (latas < 1) {
    const pct = latas * 100;
    return pct < 0.1 ? "menos del 0,1 % de una lata de 33 cl" : `el ${fmt(pct, pct < 10 ? 1 : 0)} % de una lata de 33 cl`;
  }
  return `${fmt(latas, latas < 10 ? 1 : 0)} lata${latas >= 1.05 ? "s" : ""} de 33 cl`;
};

window.cargarEstadisticas = async () => {
  const { data, error } = await sb.rpc("estadisticas");
  return error ? null : data;
};
