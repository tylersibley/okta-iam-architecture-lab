const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const app = express();
const PORT = 3000;

const oktaDomain = "https://integrator-1985580.okta.com";
const issuer = `${oktaDomain}/oauth2/default`;
const audience = "api://default";

app.use(cors());
app.use(express.json());

const client = jwksClient({
  jwksUri: `${issuer}/v1/keys`,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
      return;
    }

    const signingKey = key.getPublicKey();
    callback(null, signingKey);
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
    (err, decoded) => {
      if (err) {
        return res.status(401).json({
          message: "Invalid or expired access token",
          error: err.message,
        });
      }

      req.user = decoded;
      next();
    }
  );
}

function requireAdminGroup(req, res, next) {
  const groups = req.user.groups || [];

  if (!groups.includes("App-Admin")) {
    return res.status(403).json({
      message: "Access denied. User does not have App-Admin group claim.",
      groups,
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    message: "Okta IAM backend is running",
  });
});

app.get("/profile", verifyAccessToken, (req, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

app.get("/admin", verifyAccessToken, requireAdminGroup, (req, res) => {
  res.json({
    message: "Admin API call successful. Backend validated token and App-Admin group.",
    user: req.user.sub,
    groups: req.user.groups || [],
  });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
