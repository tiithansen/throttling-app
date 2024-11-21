package main

import (
	"net/http"
	"time"

	"fmt"
	"syscall"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	WORK_DURATION = 100 * time.Millisecond
)

func main() {

	threadRequestsHandledCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "thread_requests_handled_total",
			Help: "Number of HTTP handled by thread",
		},
		[]string{"thread_id"},
	)

	prometheus.MustRegister(threadRequestsHandledCounter)

	http.HandleFunc("/-/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/work", func(w http.ResponseWriter, r *http.Request) {
		// Do some busy work for 100ms
		// Sleep must not be used as it wont keep the CPU busy
		end := time.Now().Add(WORK_DURATION)
		for time.Now().Before(end) {

		}

		tid := syscall.Gettid()
		threadRequestsHandledCounter.WithLabelValues(fmt.Sprintf("%d", tid)).Inc()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.Handle("/metrics", promhttp.Handler())

	http.ListenAndServe(":8080", nil)
}
