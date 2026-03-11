import express from "express";
import https from "https";
import fs from "fs";
import fetch from "node-fetch";

const app = express();

const agent = new https.Agent({
  pfx: fs.readFileSync("./cert.pfx"),
  passphrase: process.env.CERT_PASSWORD
});

app.get("/scb", async (req, res) => {
  const response = await fetch(
    "https://privateapi.scb.se/nv0101/v1/sokpavar/api/ae/kategoriermedkodtabeller",
    { agent }
  );

  const data = await response.json();
  res.json(data);
});

app.listen(process.env.PORT || 3000);