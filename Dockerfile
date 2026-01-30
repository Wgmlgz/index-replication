FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/app ./

FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /out/app ./app
EXPOSE 30000
ENTRYPOINT ["/app/app"]
