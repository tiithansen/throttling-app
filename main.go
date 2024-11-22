package main

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"fmt"
	"syscall"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {

	threadRequestsHandledCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "thread_requests_handled_total",
			Help: "Number of HTTP handled by thread",
		},
		[]string{"thread_id"},
	)

	responseDurationHistogram := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "response_duration_seconds",
			Help:    "Duration of HTTP requests",
			Buckets: []float64{.005, .01, .025, .05, .075, .1, .125, .15, .175, .2, .25, .3, .4, .5, 1, 2.5, 5, 10},
		},
		[]string{"status"},
	)

	prometheus.MustRegister(threadRequestsHandledCounter)
	prometheus.MustRegister(responseDurationHistogram)

	http.HandleFunc("/-/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/work", func(w http.ResponseWriter, r *http.Request) {

		workDuration, err := time.ParseDuration(r.URL.Query().Get("duration"))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid duration"))
			return
		}

		// Do some busy work
		// Sleep must not be used as it wont keep the CPU busy
		end := time.Now().Add(workDuration)
		for time.Now().Before(end) {

		}

		tid := syscall.Gettid()
		threadRequestsHandledCounter.WithLabelValues(fmt.Sprintf("%d", tid)).Inc()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/run-test", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		duration, err := time.ParseDuration(query.Get("duration"))
		parallel, err := strconv.Atoi(query.Get("parallel"))

		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid duration"))
			return
		}

		if parallel <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid parallel value must be greater than 0"))
			return
		}

		target := os.Getenv("TEST_TARGET")
		for i := 0; i < parallel; i++ {
			go func() {
				httpClient := &http.Client{}
				end := time.Now().Add(duration)
				for time.Now().Before(end) {
					start := time.Now()
					resp, _ := httpClient.Get(target)
					reqDuration := time.Since(start)
					responseDurationHistogram.WithLabelValues(fmt.Sprintf("%d", resp.StatusCode)).Observe(reqDuration.Seconds())
				}
			}()
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.Handle("/metrics", promhttp.Handler())

	http.ListenAndServe(":8080", nil)
}
