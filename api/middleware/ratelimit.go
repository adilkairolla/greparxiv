package middleware

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.Mutex
	rate     rate.Limit
	burst    int
}

func newIPLimiter(r rate.Limit, burst int) *ipLimiter {
	return &ipLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     r,
		burst:    burst,
	}
}

func (l *ipLimiter) getLimiter(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()

	limiter, exists := l.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(l.rate, l.burst)
		l.limiters[ip] = limiter
	}
	return limiter
}

func RateLimit(requests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := newIPLimiter(rate.Limit(float64(requests)/window.Seconds()), requests)

	// Periodically clean up old entries
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			limiter.mu.Lock()
			// Simple cleanup: just clear the map
			if len(limiter.limiters) > 10000 {
				limiter.limiters = make(map[string]*rate.Limiter)
			}
			limiter.mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if !limiter.getLimiter(ip).Allow() {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
