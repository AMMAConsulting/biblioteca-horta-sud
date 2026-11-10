# Biblioteca de L'Horta Sud

Dos webs sobre un mismo Supabase (cuenta de AMMA):

- **Aportar** (`docs/aportar.html`): abierta, sin registro. Archivo (PDF/Word/txt, el texto se extrae en el navegador), enlace web o texto. La función `aportar` lo guarda, lo trocea en fragmentos y guarda el original en un bucket privado.
- **Preguntar** (`docs/preguntar.html`): con registro (correo + contraseña). La función `preguntar` busca los fragmentos (búsqueda de texto completo de Postgres) y Claude responde citando las fuentes.

Publicado en GitHub Pages desde `docs/`.

## Moderación
Para retirar una aportación: en Supabase → Table editor → `fuentes`, cambiar `estado` a `oculta` (deja de verse y de usarse en el chat) o borrar la fila.

## Ajustes (secretos de las funciones)
- `ANTHROPIC_API_KEY` (obligatorio)
- `MODELO` (por defecto `claude-opus-5-5`; más barato: `claude-haiku-5-5`)
- `LIMITE_DIA` preguntas por usuario y 24 h (50) · `LIMITE_GLOBAL` total diario (2000)

## Despliegue
```
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase config push
npx supabase functions deploy aportar --no-verify-jwt
npx supabase functions deploy preguntar --no-verify-jwt
```
