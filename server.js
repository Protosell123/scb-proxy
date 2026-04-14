import express from "express";
import https from "https";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Ladda certifikatet
const certPath = "./cert.pfx";
const agent = new https.Agent({
  pfx: fs.readFileSync(certPath),
  passphrase: process.env.CERT_PASSWORD
});

const BASE_URL_VAROR = "https://privateapi.scb.se/nv0101/v1/sokpavar";
const BASE_URL_FORETAG = "https://privateapi.scb.se/uf0101/v1/foretag";

// 1. Grundläggande hälso-check
app.get("/", (req, res) => {
  res.send("Proxy is alive. Paths available: /scb-proxy/* and /foretag-proxy/*");
});

// 2. Den nya routen för företag (uf0101) - Aggressiv matchning
app.all("/foretag-proxy*", async (req, res) => {
  try {
    // Rensar prefixet för att få fram rätt sub-path
    const subPath = req.url.replace("/foretag-proxy", "");
    const url = `${BASE_URL_FORETAG}${subPath}`;

    console.log(`[LOGG] Anropar Företagsregister: ${url}`);

    const options = {
      method: req.method,
      agent,
      headers: { "Accept": "application/json" }
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(url, options);
    const text = await response.text();

    res.status(response.status).type(response.headers.get("content-type") || "application/json").send(text);
  } catch (err) {
    console.error("[FEL]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Den gamla routen för varor (nv0101)
app.all("/scb-proxy*", async (req, res) => {
  try {
    const subPath = req.url.replace("/scb-proxy", "");
    const url = `${BASE_URL_VAROR}${subPath}`;

    const options = {
      method: req.method,
      agent,
      headers: {}
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(url, options);
    const text = await response.text();

    res.status(response.status).type(response.headers.get("content-type") || "application/json").send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
