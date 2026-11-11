# Servidor da família: compila o programa Go e corre-o numa imagem vazia (sem shell, sem root).
# Construir:  docker compose build     (ou: docker build -t jogos-servidor .)
FROM golang:1-alpine AS build
WORKDIR /src
COPY src/go.mod src/go.sum ./
RUN go mod download
COPY src/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -tags timetzdata -ldflags="-s -w" -o /mae .

FROM scratch
COPY --from=build --chmod=0555 /mae /mae
USER 65532:65532
ENV TZ=UTC MAE_DATA=/data MAE_ADDR=:8080 MAE_ORIGIN=https://localhost
EXPOSE 8080
ENTRYPOINT ["/mae"]
