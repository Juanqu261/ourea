# Despliegue

Ourea publica el demo con GitHub Pages solo después de que pase QA. Un push a `main` y un `workflow_dispatch` ejecutan el mismo pipeline. Un pull request ejecuta QA y no despliega.

## Habilitar Pages una vez

El workflow no puede activar Pages con `GITHUB_TOKEN`. Hay que hacerlo una vez en el repositorio [Juanqu261/ourea](https://github.com/Juanqu261/ourea):

1. Settings
2. Pages
3. Build and deployment
4. Source
5. GitHub Actions

Sin ese ajuste, `actions/configure-pages` no obtiene el sitio y el despliegue se detiene con este mensaje:

`GitHub Pages is not enabled for this repository. Open Settings → Pages → Build and deployment → Source → GitHub Actions once.`

## Pipeline

El archivo es `.github/workflows/ourea.yml`.

1. `qa`: pruebas de JavaScript, manifiesto, build, Python, base `/ourea/` y Playwright local.
2. `build-pages`: solo en `main`, después de QA. Usa `actions/configure-pages` y toma `base_path` como base de Vite.
3. `deploy-pages`: `actions/upload-pages-artifact` ya ocurrió en el build; este job usa `actions/deploy-pages`.
4. `verify-pages`: abre la URL que devuelve el despliegue (`page_url`), no una URL fija de otro usuario.

Si QA falla, los jobs siguientes no corren.

## Base del sitio

El sitio de proyecto vive bajo `/ourea/`. Vite recibe esa ruta desde Pages, con barra final. Los datos, el GeoJSON y el worker de MapLibre se piden con `import.meta.env.BASE_URL`, así que no quedan en `https://<usuario>.github.io/data/`.

## Antes de hacer push

Regenera el manifiesto y después comprueba sin reescribirlo:

```bash
python scripts/make_manifest.py
python scripts/make_manifest.py --check
```

En Windows, `qa_windows.bat`. En macOS o Linux, `./qa_mac_linux.sh`. Esas comprobaciones usan `--check`. Si el manifiesto está viejo, el mensaje pide volver a generarlo. No borres la validación.

`make_manifest.py` excluye `dist/`, `node_modules/`, `CLIMATERISK/`, `data/public/` y archivos de secretos. Normaliza CRLF a LF en texto para que la suma no dependa del sistema.

## Versiones de Actions

Las actions oficiales usadas, a octubre de 2026, corren en Node.js 24: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`, `actions/upload-artifact@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` y `actions/deploy-pages@v5`. La aplicación sigue compilándose con Node.js 20.19, que es el mínimo del proyecto. Un aviso del runner sobre Node 20 dentro de una action antigua no debe tumbar el job; estas versiones mayores ya no usan ese runtime.

## Vercel: sitio y capa de IA

Pages solo sirve archivos estáticos, así que ahí no hay IA. En Vercel el mismo repositorio se despliega como dos proyectos:

| Proyecto | Root Directory | Qué despliega |
|---|---|---|
| `ourea-ai` | raíz del repositorio | `services/decision_ai/app.py` como una función de Python |
| `ourea` | `frontend` | el sitio de Vite |

El servicio vive en la raíz porque el motor lee `frontend/public/data/cornare/` e importa `scripts/climaterisk/institutional.py`.

- `pyproject.toml` indica el punto de entrada (`[tool.vercel] entrypoint`) y las dependencias de ejecución. `uv.lock` las fija. Sus versiones deben coincidir con `requirements.txt` y `requirements-ai.txt`. numpy queda exacto porque la huella del motor incluye su versión.
- `vercel.json` da 300 s a la función (el copiloto puede reintentar) y deja fuera del paquete lo que no usa en ejecución.
- No hay `.vercelignore`: excluía los datos, `scripts/` y los `prompt.md` de los agentes.

Variables de `ourea-ai`:

| Variable | Valor |
|---|---|
| `OUREA_AI_ENABLED` | `1` |
| `OPENAI_API_KEY` | la llave (marcada como Sensitive) |
| `OPENAI_MODEL` | `gpt-5.6-terra` |
| `OUREA_VAR_DIR` | `/tmp/ourea`. Vercel solo permite escribir en `/tmp`, y lo que se escribe ahí se pierde cuando la instancia se recicla. |
| `ALLOWED_ORIGINS` | el dominio del sitio, por ejemplo `https://ourea.vercel.app` |
| `ALLOWED_ORIGIN_REGEX` | opcional, para los previews: `^https://ourea-[a-z0-9-]+-<equipo>\.vercel\.app$` |

Variable de `ourea`: `VITE_OUREA_AI_API_URL=https://<dominio de ourea-ai>/api`. Vite la fija al compilar: si cambia, hay que volver a desplegar el sitio.

Comprobación: `https://<dominio de ourea-ai>/api/health` devuelve `"ai_enabled": true`.

Límite conocido: los agentes guardan sus hilos en memoria (`InMemorySaver`). La entrevista usa dos peticiones (`start` y `answer`); si caen en instancias distintas, la segunda responde «No interview waiting on this thread». Para quitarlo hace falta un checkpointer persistente, por ejemplo Postgres.
