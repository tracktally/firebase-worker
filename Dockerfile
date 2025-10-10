FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends tini jq curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install
COPY . .
ENTRYPOINT ["/usr/bin/tini", "--"]

ENV TZ=Europe/Zurich

## default script
CMD ["./run/run-test.sh"]