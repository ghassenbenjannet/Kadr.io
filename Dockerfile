# Registre SI — image de production : backend Hono + agent, front React
# déjà construit et servi en statique. Un seul process, un seul port.

# ---- Stage 1 : build -------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 a des binaires précompilés pour la plupart des plateformes,
# mais on garde une chaîne de compilation au cas où npm doive reconstruire.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Dépendances du backend
COPY package.json package-lock.json ./
RUN npm ci

# Dépendances du front (couche séparée pour le cache Docker)
COPY front/package.json front/package-lock.json front/
RUN cd front && npm ci

# Reste des sources, puis build complet (backend + front, cf. package.json)
COPY . .
RUN npm run build

# Ne garde que les dépendances de production dans node_modules, sans
# relancer d'install (donc sans risque de devoir recompiler ailleurs)
RUN npm prune --omit=dev

# ---- Stage 2 : runtime ------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN useradd --create-home --home-dir /data --shell /usr/sbin/nologin registre \
    && mkdir -p /data \
    && chown -R registre:registre /data /app

COPY --from=build --chown=registre:registre /app/node_modules ./node_modules
COPY --from=build --chown=registre:registre /app/dist ./dist
COPY --from=build --chown=registre:registre /app/package.json ./package.json

# HOME=/data : la config (~/.registre-si/config.json), la base SQLite et
# les identifiants Zoho vivent tous sous ce point de montage unique —
# monte un volume ici pour persister l'état entre deux `docker run`.
ENV HOME=/data
USER registre

EXPOSE 3737
CMD ["node", "dist/server/index.js"]
