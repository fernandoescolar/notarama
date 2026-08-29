package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

const (
	sessionCookieName = "notarama_session"
	stateCookieName   = "notarama_oauth_state"
	nonceCookieName   = "notarama_oauth_nonce"
	CSRFHeader        = "X-CSRF-Token"
)

type ctxKey string

const userIDCtxKey ctxKey = "userID"
const csrfCtxKey ctxKey = "csrf"

type Service struct {
	store   *Store
	oidc    *oidcClient // nil when DevAuthBypass is enabled
	secure  bool        // cookies use Secure flag when the app is served over https
	devMode bool
}

// New builds the auth service. When devBypass is true no OIDC provider is
// contacted; a fixed local development user is used instead so the app can
// be exercised without a real identity provider.
func New(ctx context.Context, store *Store, issuerURL, clientID, clientSecret, redirectURL string, devBypass bool) (*Service, error) {
	svc := &Service{store: store, devMode: devBypass, secure: strings.HasPrefix(redirectURL, "https://")}
	if devBypass {
		return svc, nil
	}
	client, err := newOIDCClient(ctx, issuerURL, clientID, clientSecret, redirectURL)
	if err != nil {
		return nil, err
	}
	svc.oidc = client
	return svc, nil
}

func randomString() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) setCookie(w http.ResponseWriter, name, value string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
	})
}

func (s *Service) clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// LoginHandler starts the OIDC authorization-code flow, or in dev-bypass
// mode logs the fixed local user in immediately.
func (s *Service) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if s.devMode {
		user, err := s.store.UpsertUser("dev-user", "dev@localhost", "Dev User")
		if err != nil {
			http.Error(w, "dev login failed", http.StatusInternalServerError)
			return
		}
		s.startSession(w, user.ID)
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	state, err := randomString()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	nonce, err := randomString()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.setCookie(w, stateCookieName, state, 10*time.Minute)
	s.setCookie(w, nonceCookieName, nonce, 10*time.Minute)
	http.Redirect(w, r, s.oidc.oauth2Config.AuthCodeURL(state, oidc.Nonce(nonce)), http.StatusFound)
}

// CallbackHandler completes the OIDC flow after the identity provider
// redirects the browser back with an authorization code.
func (s *Service) CallbackHandler(w http.ResponseWriter, r *http.Request) {
	if s.devMode {
		http.NotFound(w, r)
		return
	}

	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	nonceCookie, err := r.Cookie(nonceCookieName)
	if err != nil {
		http.Error(w, "missing nonce", http.StatusBadRequest)
		return
	}
	s.clearCookie(w, stateCookieName)
	s.clearCookie(w, nonceCookieName)

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	claims, err := s.oidc.exchange(r.Context(), code, nonceCookie.Value)
	if err != nil {
		http.Error(w, "login failed: "+err.Error(), http.StatusUnauthorized)
		return
	}

	user, err := s.store.UpsertUser(claims.Sub, claims.Email, claims.Name)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	s.startSession(w, user.ID)
	http.Redirect(w, r, "/", http.StatusFound)
}

func (s *Service) startSession(w http.ResponseWriter, userID string) {
	sess, err := s.store.CreateSession(userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.setCookie(w, sessionCookieName, sess.ID, sessionTTL)
}

func (s *Service) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookieName); err == nil {
		_ = s.store.DeleteSession(c.Value)
	}
	s.clearCookie(w, sessionCookieName)
	w.WriteHeader(http.StatusNoContent)
}

// RequireAuth validates the session cookie, checks the CSRF header on
// mutating requests, and injects the user id and csrf token into the
// request context for downstream handlers.
func (s *Service) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		sess, err := s.store.GetSession(c.Value)
		if errors.Is(err, ErrNotFound) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		if isMutating(r.Method) {
			if r.Header.Get(CSRFHeader) != sess.CSRFToken {
				http.Error(w, "csrf token mismatch", http.StatusForbidden)
				return
			}
		}

		ctx := context.WithValue(r.Context(), userIDCtxKey, sess.UserID)
		ctx = context.WithValue(ctx, csrfCtxKey, sess.CSRFToken)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isMutating(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func UserID(ctx context.Context) string {
	v, _ := ctx.Value(userIDCtxKey).(string)
	return v
}

func CSRFToken(ctx context.Context) string {
	v, _ := ctx.Value(csrfCtxKey).(string)
	return v
}

func (s *Service) Store() *Store { return s.store }
