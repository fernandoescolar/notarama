package auth

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type oidcClient struct {
	provider     *oidc.Provider
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier
}

func newOIDCClient(ctx context.Context, issuerURL, clientID, clientSecret, redirectURL string) (*oidcClient, error) {
	provider, err := oidc.NewProvider(ctx, issuerURL)
	if err != nil {
		return nil, fmt.Errorf("discover OIDC issuer: %w", err)
	}
	cfg := oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})
	return &oidcClient{provider: provider, oauth2Config: cfg, verifier: verifier}, nil
}

type idClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	PreferredName string `json:"preferred_username"`
}

func (c *oidcClient) exchange(ctx context.Context, code, nonce string) (*idClaims, error) {
	token, err := c.oauth2Config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchange code: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("token response missing id_token")
	}
	idToken, err := c.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("verify id_token: %w", err)
	}
	if idToken.Nonce != nonce {
		return nil, fmt.Errorf("nonce mismatch")
	}
	var claims idClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}
	if claims.Name == "" {
		claims.Name = claims.PreferredName
	}
	if claims.Name == "" {
		claims.Name = claims.Email
	}
	return &claims, nil
}
