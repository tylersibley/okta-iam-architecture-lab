# Enterprise IAM Architecture (Okta + AWS)

## Overview

This project simulates how an enterprise uses Okta as an Identity Provider (IdP) to manage authentication, enforce Multi-Factor Authentication (MFA), and provide secure access to internal applications and AWS resources.

The goal is to demonstrate real-world identity concepts including Single Sign-On (SSO), Role-Based Access Control (RBAC), and user lifecycle management.

---

## Architecture Diagram

![IAM Diagram](iam_diagram.png)

---

## How It Works

1. A user attempts to access an internal application.
2. The application redirects the user to Okta for authentication.
3. Okta prompts the user for credentials and enforces MFA.
4. Upon successful authentication, Okta issues a token (OIDC or SAML).
5. The application validates the token and grants access.
6. (Optional) The user can access AWS resources via federated login.

---

## Key Features

* Single Sign-On (SSO)
* Multi-Factor Authentication (MFA)
* Role-Based Access Control (RBAC)
* User Lifecycle Management
* (Optional) AWS Federation

---

## Technologies Used

* Okta (Identity Provider)
* AWS (IAM, optional integration)
* OpenID Connect (OIDC) / SAML

---

## Why This Matters

Centralizing authentication through an Identity Provider like Okta improves security, simplifies access management, and enables scalable user lifecycle control across enterprise systems.

---

## Demo (Coming Soon)

A walkthrough of the login flow and system behavior will be added.
