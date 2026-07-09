FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml* ./
# No broken pnpm-workspace in the install layer
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
# Fix workspace file if present (must include packages)
RUN if [ -f pnpm-workspace.yaml ]; then \
      printf 'packages:\n  - "."\n' > pnpm-workspace.yaml; \
    fi

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV A0_URL=http://bridge:8641

EXPOSE 3000

CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
