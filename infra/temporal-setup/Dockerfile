FROM golang:1.24 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download -x
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o temporal-setup .

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/temporal-setup .
CMD ["./temporal-setup"]
