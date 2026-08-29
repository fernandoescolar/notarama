// Package config loads Notarama's runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	ListenAddr string
	DataDir    string
	AppBaseURL string

	SessionSecret string

	OIDCIssuerURL    string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURL  string

	DevAuthBypass bool
}

func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr: getEnv("LISTEN_ADDR", ":8080"),
		DataDir:    getEnv("DATA_DIR", "./data"),
		AppBaseURL: getEnv("APP_BASE_URL", "http://localhost:8080"),

		SessionSecret: os.Getenv("SESSION_SECRET"),

		OIDCIssuerURL:    os.Getenv("OIDC_ISSUER_URL"),
		OIDCClientID:     os.Getenv("OIDC_CLIENT_ID"),
		OIDCClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
		OIDCRedirectURL:  os.Getenv("OIDC_REDIRECT_URL"),

		DevAuthBypass: getEnv("DEV_AUTH_BYPASS", "") == "1",
	}

	if cfg.OIDCRedirectURL == "" {
		cfg.OIDCRedirectURL = cfg.AppBaseURL + "/auth/callback"
	}

	if !cfg.DevAuthBypass {
		if cfg.OIDCIssuerURL == "" || cfg.OIDCClientID == "" || cfg.OIDCClientSecret == "" {
			return nil, fmt.Errorf("OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required unless DEV_AUTH_BYPASS=1")
		}
	}

	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("SESSION_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
