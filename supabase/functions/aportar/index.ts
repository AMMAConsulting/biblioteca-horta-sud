// Recibe una aportación abierta (archivo, enlace o texto), la guarda y la trocea para el chat.
// El texto de PDF/Word se extrae en el navegador (pdf.js / mammoth) para no agotar la CPU aquí.
import { admin, CORS, json, MUNICIPIOS } from "../_shared/comun.ts";

const MAX_TEXTO = 2_000_000;       // ~ 600 páginas
const MIN_TEXTO = 150;
const MAX_ARCHIVO = 15 * 1024 * 1024;
const LIMITE_HORA = 40;            // aportaciones por IP y hora
const TAM = 1200, SOLAPE = 150;

const limpio = (v: FormDataEntryValue | null, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function trocear(texto: string): string[] {
  const parrafos = texto.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const trozos: string[] = [];
  let actual = "";
  const cerrar = () => { if (actual.trim().length > 40) trozos.push(actual.trim()); };
  for (const p of parrafos) {
    if (p.length > TAM) {
      cerrar(); actual = "";
      for (let i = 0; i < p.length; i += TAM - SOLAPE) trozos.push(p.slice(i, i + TAM));
      continue;
    }
    if ((actual + " " + p).length > TAM) {
      cerrar();
      actual = actual.slice(-SOLAPE) + " " + p;
    } else actual += (actual ? "\n" : "") + p;
  }
  cerrar();
  return trozos;
}

function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

function urlSegura(u: string): URL | null {
  try {
    const url = new URL(u);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
        /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h)) return null;
    return url;
  } catch { return null; }
}

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "Formulario no válido" }, 400); }

  if (limpio(form.get("web"), 10)) return json({ ok: true }); // trampa antispam: los bots la rellenan
  if (form.get("acepto") !== "si") return json({ error: "Tienes que confirmar que puedes compartir este material." }, 400);

  const modo = limpio(form.get("modo"), 10);
  const titulo = limpio(form.get("titulo"), 300);
  const municipio = limpio(form.get("municipio"), 60);
  const anioTxt = limpio(form.get("anio"), 4);
  const anio = /^\d{4}$/.test(anioTxt) ? Number(anioTxt) : null;
  if (titulo.length < 3) return json({ error: "Falta el título." }, 400);
  if (!MUNICIPIOS.includes(municipio)) return json({ error: "Elige un municipio de la lista." }, 400);
  if (!["archivo", "url", "texto"].includes(modo)) return json({ error: "Tipo de aportación no válido." }, 400);

  const db = admin();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  const ipHash = await sha256(ip + (Deno.env.get("SUPABASE_URL") ?? ""));
  const { count } = await db.from("fuentes").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("creado", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= LIMITE_HORA) return json({ error: "Demasiadas aportaciones seguidas. Prueba dentro de un rato." }, 429);

  let texto = "";
  let tipo = "texto";
  let url: string | null = null;
  let archivo: File | null = null;

  if (modo === "url") {
    const u = urlSegura(limpio(form.get("url"), 2000));
    if (!u) return json({ error: "El enlace no es válido." }, 400);
    url = u.toString(); tipo = "url";
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow",
        headers: { "User-Agent": "BibliotecaHortaSud/1.0", "Accept": "text/html,text/plain" } });
      const ct = r.headers.get("content-type") ?? "";
      if (!r.ok) return json({ error: `La página respondió con un error (${r.status}).` }, 400);
      if (ct.includes("pdf")) return json({ error: "Ese enlace es un PDF: descárgalo y súbelo como archivo." }, 400);
      const cuerpo = (await r.text()).slice(0, 3_000_000);
      texto = ct.includes("html") ? htmlATexto(cuerpo) : cuerpo;
    } catch {
      return json({ error: "No se ha podido abrir el enlace." }, 400);
    }
  } else {
    texto = typeof form.get("texto") === "string" ? (form.get("texto") as string) : "";
    if (modo === "archivo") {
      const f = form.get("archivo");
      if (!(f instanceof File)) return json({ error: "Falta el archivo." }, 400);
      if (f.size > MAX_ARCHIVO) return json({ error: "El archivo supera los 15 MB." }, 400);
      archivo = f;
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      tipo = ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : "txt";
    }
  }

  texto = texto.replace(/\u0000/g, "").trim();
  if (texto.length < MIN_TEXTO) {
    return json({ error: tipo === "pdf"
      ? "No se ha podido leer texto del PDF. Si es un documento escaneado, pásalo antes por un OCR."
      : "Hay muy poco texto: añade algo más de contenido." }, 400);
  }
  if (texto.length > MAX_TEXTO) return json({ error: "El documento es demasiado largo (máx. ~600 páginas). Divídelo en partes." }, 400);

  const trozos = trocear(texto);
  const { data: fuente, error: e1 } = await db.from("fuentes").insert({
    titulo, municipio, anio, tipo, url,
    autor: limpio(form.get("autor"), 300) || null,
    tema: limpio(form.get("tema"), 100) || null,
    aportado_por: limpio(form.get("aportado_por"), 120) || null,
    descripcion: limpio(form.get("descripcion"), 1000) || null,
    n_caracteres: texto.length, n_fragmentos: trozos.length, ip_hash: ipHash,
  }).select("id").single();
  if (e1 || !fuente) { console.error(e1); return json({ error: "No se ha podido guardar. Inténtalo de nuevo." }, 500); }

  for (let i = 0; i < trozos.length; i += 500) {
    const { error } = await db.from("fragmentos").insert(
      trozos.slice(i, i + 500).map((t, j) => ({ fuente_id: fuente.id, orden: i + j, texto: t })));
    if (error) {
      console.error(error);
      await db.from("fuentes").delete().eq("id", fuente.id);
      return json({ error: "No se ha podido procesar el texto. Inténtalo de nuevo." }, 500);
    }
  }

  if (archivo) {
    const nombre = archivo.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
    const ruta = `${fuente.id}/${nombre}`;
    const { error } = await db.storage.from("bibliografia").upload(ruta, archivo, { contentType: archivo.type || undefined });
    if (!error) await db.from("fuentes").update({ archivo: ruta }).eq("id", fuente.id);
    else console.error(error);
  }

  return json({ ok: true, id: fuente.id, fragmentos: trozos.length, caracteres: texto.length });
});
