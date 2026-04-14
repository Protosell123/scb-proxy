import express from "express";
import https from "https";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

const agent = new https.Agent({
  pfx: fs.readFileSync("./cert.pfx"),
  passphrase: process.env.CERT_PASSWORD
});

// Gamla bas-URL:en för varusök
const BASE_URL_VAROR = "https://privateapi.scb.se/nv0101/v1/sokpavar";
// NY bas-URL för företagsregistret (org-nummer)
const BASE_URL_FORETAG = "https://privateapi.scb.se/uf0101/v1/foretag";

app.get("/", (req, res) => {
  res.send("SCB proxy running with support for both Goods and Companies");
});

// Route för företagsuppslag (Används för org-nr)
app.all("/foretag-proxy/*", async (req, res) => {
  try {
    const path = req.params[0];
    const url = `${BASE_URL_FORETAG}/${path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

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

    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Behåll den gamla proxyn så att din nuvarande filtrering inte går sönder
app.all("/scb-proxy/*", async (req, res) => {
  try {
    const path = req.params[0];
    const url = `${BASE_URL_VAROR}/${path}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

    const options = {
      method: req.method,      agent,
      headers: {}
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(url, options);
    const text = await response.text();

    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (err) {
    res.status(
