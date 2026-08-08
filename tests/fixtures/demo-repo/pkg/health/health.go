package health

import "net/http"

// HandleHealthCheck responds 200 OK if the service is alive.
func HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

// TODO: wire this into the real router once main.go exists.
func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", HandleHealthCheck)
}
