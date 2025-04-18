import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import jose from "node-jose";

const OUTPUT_DIR = "./keys";
const RSA_PRIVATE_KEY_PATH = path.join(OUTPUT_DIR, "rsa_private.pem");
const EC_PRIVATE_KEY_PATH = path.join(OUTPUT_DIR, "ec_private.pem");

// Helper function to ask for confirmation
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

// Function to check if output files already exist
async function checkExistingFiles(forceOverwrite) {
  if (fs.existsSync(RSA_PRIVATE_KEY_PATH) || fs.existsSync(EC_PRIVATE_KEY_PATH)) {
    if (forceOverwrite) {
      console.log("Force overwrite enabled. Existing files will be deleted.");
      fs.unlinkSync(RSA_PRIVATE_KEY_PATH);
      fs.unlinkSync(EC_PRIVATE_KEY_PATH);
      return;
    }

    console.log("One or more output files already exist:");
    if (fs.existsSync(RSA_PRIVATE_KEY_PATH)) {
      console.log(`  - ${RSA_PRIVATE_KEY_PATH}`);
    }
    if (fs.existsSync(EC_PRIVATE_KEY_PATH)) {
      console.log(`  - ${EC_PRIVATE_KEY_PATH}`);
    }

    const answer = await askQuestion("Do you want to delete them and continue? (yes/no): ");
    if (answer.toLowerCase() === "yes") {
      if (fs.existsSync(RSA_PRIVATE_KEY_PATH)) fs.unlinkSync(RSA_PRIVATE_KEY_PATH);
      if (fs.existsSync(EC_PRIVATE_KEY_PATH)) fs.unlinkSync(EC_PRIVATE_KEY_PATH);
    } else {
      console.log("Operation cancelled. No files were deleted.");
      process.exit(0);
    }
  }
}

// Function to generate keys using OpenSSL
function generateKeys() {
  try {
    console.log("Generating RSA private key...");
    execSync(`openssl genpkey -algorithm RSA -out ${RSA_PRIVATE_KEY_PATH} -pkeyopt rsa_keygen_bits:2048`);
    console.log("RSA private key generated.");

    console.log("Generating EC private key...");
    execSync(`openssl ecparam -name prime256v1 -genkey -noout -out ${EC_PRIVATE_KEY_PATH}`);
    console.log("EC private key generated.");
  } catch (err) {
    console.error("Error generating keys:", err.message);
    process.exit(1);
  }
}

// Function to convert PEM to JWK and match the exact structure
async function convertKeysToJwk() {
  try {
    const keystore = jose.JWK.createKeyStore();

    // Read and convert RSA private key to JWK
    const rsaKeyPem = fs.readFileSync(RSA_PRIVATE_KEY_PATH, "utf8");
    const rsaKey = await keystore.add(rsaKeyPem, "pem");
    const rsaJwk = rsaKey.toJSON(true); // Include private key

    const orderedRsaJwk = {
      d: rsaJwk.d,
      dp: rsaJwk.dp,
      dq: rsaJwk.dq,
      e: rsaJwk.e,
      kty: rsaJwk.kty,
      n: rsaJwk.n,
      p: rsaJwk.p,
      q: rsaJwk.q,
      qi: rsaJwk.qi,
      use: "sig",
    };

    // Read and convert EC private key to JWK
    const ecKeyPem = fs.readFileSync(EC_PRIVATE_KEY_PATH, "utf8");
    const ecKey = await keystore.add(ecKeyPem, "pem");
    const ecJwk = ecKey.toJSON(true); // Include private key

    const orderedEcJwk = {
      crv: ecJwk.crv,
      d: ecJwk.d,
      kty: ecJwk.kty,
      use: "sig",
      x: ecJwk.x,
      y: ecJwk.y,
    };

    return [orderedRsaJwk, orderedEcJwk];
  } catch (err) {
    console.error("Error converting keys to JWK:", err.message);
    process.exit(1);
  }
}

// Main function to execute the script
async function main() {
  const forceOverwrite = process.argv.includes("-f");

  // Check if files already exist and handle overwrite logic
  await checkExistingFiles(forceOverwrite);

  // Step 1: Generate key pairs using OpenSSL
  generateKeys();

  // Step 2: Convert the generated keys into JWK format
  const jwkKeys = await convertKeysToJwk();

  // Step 3: Construct the final JWKS object matching the exact format
  const jwks = {
    keys: jwkKeys,
  };

  // Step 4: Write the JWKS object to a file
  const JWKS_OUTPUT_PATH = path.join(OUTPUT_DIR, "jwks.json");
  fs.writeFileSync(JWKS_OUTPUT_PATH, JSON.stringify(jwks, null, 2));
  console.log("JWKS successfully created at:", JWKS_OUTPUT_PATH);

  // Print final JWKS to console
  console.log("Generated JWKS:");
  console.log(JSON.stringify(jwks, null, 2));
}

// Execute the script
main();