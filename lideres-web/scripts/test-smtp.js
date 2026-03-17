const nodemailer = require("nodemailer");

async function run() {

  const transporter = nodemailer.createTransport({
    host: "dsmexch02.dismac.com.bo",
    port: 25,
    secure: false,
    auth: undefined, // importante
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    await transporter.verify();
    console.log("SMTP verify OK");
  } catch (err) {
    console.error("SMTP verify failed:", err);
  }
}

run();