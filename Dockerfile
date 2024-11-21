FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY . .

RUN go mod download
RUN go build -o /app/main .

FROM alpine:3.20

COPY --from=builder /app/main /app/main

CMD ["/app/main"]
