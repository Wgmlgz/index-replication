FROM golang:1.24 as builder
WORKDIR /app
COPY go.* .
RUN go mod download -x
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./main.go

FROM alpine:latest
WORKDIR /root/
RUN apk add --no-cache ca-certificates && update-ca-certificates
COPY --from=builder /app/app .
COPY --from=builder /app/internal/config ./internal/config
COPY --from=builder /app/migrations ./migrations
COPY wait-for-db.sh ./wait-for-db.sh
RUN chmod +x ./wait-for-db.sh
# ENV GIN_MODE=release
EXPOSE 8080
CMD ["sh", "-c", "./wait-for-db.sh ./app"]
