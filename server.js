import express from "express";
import https from "https";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Ladda certifikatet en gång vid start
const pfxBuffer = fs.readFileSync("./cert.pfx");

// Skapa en dedikerad agent för mTLS
const agent = new https.Agent({
  pfx: pfxBuffer,
  passphrase: process.env.CERT_PASSWORD,
  rejectUnauthorized: false // Ibland nödvändigt för SCB:s interna certifikatkedja
});

const BASE_URL_VAROR = "https://privateapi.scb.se/nv0101/v1/sokpavar";
const BASE_URL_FORETAG = "https://privateapi.scb.se/uf0101/v1/foretag";

app.get("/", (req, res) => {
  res.send("Proxy is alive. Paths: /scb-proxy/* and /foretag-proxy/*");
});

// Företagsregistret (uf0101)
app.all("/foretag-proxy*", async (req, res) => {
  try {
    const subPath = req.url.replace("/foretag-proxy", "");
    const url = `${BASE_URL_FORETAG}${subPath}`;

    console.log(`[mTLS Request] Targeting: ${url}`);

    const options = {
      method: req.method,
      agent: agent, // Dubbelkoll: Agenten bifogas här
      headers: {
        "Accept": "application/json",
        "User-Agent": "Railway-Proxy-App"
      }
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(url, options);
    const text = await response.text();

    // Om SCB skickar HTML (Utloggad-sidan), kasta ett tydligt fel
    if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      console.error("[SCB Error] Received HTML (Login page) instead of JSON. Cert rejected.");
      return res.status(401).json({ 
        error: "SCB rejected Certificate/Authentication",
        details: "The proxy received a login page. Check if the .p12 cert is valid for uf0101." 
      });
    }

    res.status(response.status).type("application/json").send(text);
  } catch (err) {
    console.error("[System Error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Behåll den gamla för varor (identisk logik)
app.all("/scb-proxy*", async (req, res) => {
  try {
    const subPath = req.url.replace("/scb-proxy", "");
    const url = `${BASE_URL_VAROR}${subPath}`;
    
    const response = await fetch(url, { 
      agent, 
      method: req.method,
      headers: { "Accept": "application/json" }
    });
    
    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on ${PORT}`));
