import express from "express";
import https from "https";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// 1. SÄKERHETSKOLL: Starta bara om certifikatet finns
let agent;
try {
  if (fs.existsSync("./cert.pfx")) {
    agent = new https.Agent({
      pfx: fs.readFileSync("./cert.pfx"),
      passphrase: process.env.CERT_PASSWORD,
      // Vissa Node-versioner kräver att man tillåter äldre certifikat-algoritmer
      secureOptions: 0, 
      rejectUnauthorized: false 
    });
    console.log("Certifikat laddat korrekt.");
  } else {
    console.error("KRITISKT FEL: cert.pfx hittades inte i rotmappen!");
  }
} catch (err) {
  console.error("KRITISKT FEL vid laddning av certifikat:", err.message);
}

const BASE_URL_VAROR = "https://privateapi.scb.se/nv0101/v1/sokpavar";
const BASE_URL_FORETAG = "https://privateapi.scb.se/uf0101/v1/foretag";

app.get("/", (req, res) => {
  res.send("Proxy is UP. Status: " + (agent ? "Cert Loaded" : "Cert Missing"));
});

// Universell Proxy-funktion
async function handleProxyRequest(req, res, targetBaseUrl) {
  try {
    const subPath = req.url.split('/').slice(2).join('/'); // Tar bort /scb-proxy eller /foretag-proxy
    const url = `${targetBaseUrl}/${subPath}`;
    
    console.log(`[Proxy] ${req.method} -> ${url}`);

    if (!agent) throw new Error("Agent not initialized - check cert/password");

    const options = {
      method: req.method,
      agent: agent,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Railway-Proxy"
      }
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const data = await response.text();

    // Kolla efter SCB:s utloggningssida
    if (data.includes("SCB - Utloggad") || data.includes("<html")) {
      return res.status(401).json({ 
        error: "SCB rejected cert (Logged out)",
        hint: "Kontrollera att CERT_PASSWORD är rätt och att certifikatet är aktivt."
      });
    }

    res.status(response.status).type("application/json").send(data);
  } catch (err) {
    console.error("[Proxy Error]", err.message);
    res.status(500).json({ error: err.message });
  }
}

app.all("/foretag-proxy/*", (req, res) => handleProxyRequest(req, res, BASE_URL_FORETAG));
app.all("/scb-proxy/*", (req, res) => handleProxyRequest(req, res, BASE_URL_VAROR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server redo på port ${PORT}`));
