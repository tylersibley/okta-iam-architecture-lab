const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const app = express();
const PORT = process.env.PORT || 3000;

const oktaDomain = "https://integrator-1985580.okta.com";
const issuer = `${oktaDomain}/oauth2/default`;
const audience = "api://default";

app.use(cors());
app.use(express.json());

const client = jwksClient({
  jwksUri: `${issuer}/v1/keys`,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(
    token,
    getSigningKey,
    {
      issuer,
      audience,
      algorithms: ["RS256"],
    },
    (err, decodedToken) => {
      if (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({
          message: "Invalid or expired access token",
          error: err.message,
        });
      }

      console.log("Verified token:", {
        subject: decodedToken.sub,
        issuer: decodedToken.iss,
        audience: decodedToken.aud,
        groups: decodedToken.groups || [],
      });

      req.user = decodedToken;
      next();
    }
  );
}

function requireGroup(groupName) {
  return (req, res, next) => {
    const groups = req.user.groups || [];

    if (!groups.includes(groupName)) {
      return res.status(403).json({
        message: `Access denied. Required group: ${groupName}`,
        userGroups: groups,
      });
    }

    next();
  };
}

function requireAnyGroup(allowedGroups) {
  return (req, res, next) => {
    const groups = req.user.groups || [];
    const allowed = allowedGroups.some((group) => groups.includes(group));

    if (!allowed) {
      return res.status(403).json({
        message: `Access denied. Required one of: ${allowedGroups.join(", ")}`,
        userGroups: groups,
      });
    }

    next();
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "Okta IAM backend is running",
    endpoints: [
      "/verify",
      "/sales-data",
      "/engineering-data",
      "/admin-data",
    ],
  });
});

app.get("/verify", verifyAccessToken, (req, res) => {
  res.json({
    message: "Token is valid. Backend successfully verified JWT signature, issuer, audience, and expiration.",
    tokenClaims: {
      subject: req.user.sub,
      issuer: req.user.iss,
      audience: req.user.aud,
      email: req.user.email || "No email claim",
      groups: req.user.groups || [],
      issuedAt: req.user.iat,
      expiresAt: req.user.exp,
      scopes: req.user.scp || [],
    },
  });
});

app.get(
  "/sales-data",
  verifyAccessToken,
  requireAnyGroup(["App-Sales", "App-Engineer", "App-Admin"]),
  (req, res) => {
    res.json({
      message: "Sales data access granted.",
      data: {
        dashboard: "Customer usage metrics",
        report: "Quarterly sales activity",
      },
    });
  }
);

app.get(
  "/engineering-data",
  verifyAccessToken,
  requireAnyGroup(["App-Engineer", "App-Admin"]),
  (req, res) => {
    res.json({
      message: "Engineering data access granted.",
      data: {
        logs: "System logs",
        tools: "Developer diagnostics",
      },
    });
  }
);

app.get(
  "/admin-data",
  verifyAccessToken,
  requireGroup("App-Admin"),
  (req, res) => {
    res.json({
      message: "Admin data access granted.",
      data: {
        users: "User management",
        policies: "Security policy controls",
        settings: "Application configuration",
      },
    });
  }
);

app.get("/admin", verifyAccessToken, requireGroup("App-Admin"), (req, res) => {
  res.json({
    message: "Admin API action successful. User has App-Admin group.",
  });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
