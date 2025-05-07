import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import jose from "node-jose";

const OUTPUT_DIR = "./keys";
const RSA_PRIVATE_KEY_PATH = path.join(OUTPUT_DIR, "rsa_private.pem");
const EC_PRIVATE_KEY_PATH = path.join(OUTPUT_DIR, "ec_private.pem");

// Helper function to ask for confirmation
function askQuestion(query: string): Promise<string> {
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
async function checkExistingFiles(forceOverwrite: boolean): Promise<void> {
  if (fs.existsSync(RSA_PRIVATE_KEY_PATH) || fs.existsSync(EC_PRIVATE_KEY_PATH)) {
    if (forceOverwrite) {
      console.log("Force overwrite enabled. Existing files will be deleted.");
      if (fs.existsSync(RSA_PRIVATE_KEY_PATH)) fs.unlinkSync(RSA_PRIVATE_KEY_PATH);
      if (fs.existsSync(EC_PRIVATE_KEY_PATH)) fs.unlinkSync(EC_PRIVATE_KEY_PATH);
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
function generateKeys(): void {
  try {
    console.log("Generating RSA private key...");
    execSync(`openssl genpkey -algorithm RSA -out ${RSA_PRIVATE_KEY_PATH} -pkeyopt rsa_keygen_bits:2048`);
    console.log("RSA private key generated.");

    console.log("Generating EC private key...");
    execSync(`openssl ecparam -name prime256v1 -genkey -noout -out ${EC_PRIVATE_KEY_PATH}`);
    console.log("EC private key generated.");
  } catch (err) {
    console.error("Error generating keys:", (err as Error).message);
    process.exit(1);
  }
}

// Define types for JWK
interface RsaJwk {
  d?: string;
  dp?: string;
  dq?: string;
  e: string;
  kty: string;
  n: string;
  p?: string;
  q?: string;
  qi?: string;
  use: string;
}

interface EcJwk {
  crv: string;
  d?: string;
  kty: string;
  use: string;
  x: string;
  y: string;
}

type JwkKey = RsaJwk | EcJwk;

// Function to convert PEM to JWK and match the exact structure
async function convertKeysToJwk(includePrivate = true): Promise<JwkKey[]> {
  try {
    const keystore = jose.JWK.createKeyStore();

    // Read and convert RSA private key to JWK
    const rsaKeyPem = fs.readFileSync(RSA_PRIVATE_KEY_PATH, "utf8");
    const rsaKey = await keystore.add(rsaKeyPem, "pem");
    const rsaJwk = rsaKey.toJSON(includePrivate) as any; // Include private key if requested

    // Create ordered JWK with or without private components
    const orderedRsaJwk: RsaJwk = includePrivate ? {
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
    } : {
      e: rsaJwk.e,
      kty: rsaJwk.kty,
      n: rsaJwk.n,
      use: "sig",
    };

    // Read and convert EC private key to JWK
    const ecKeyPem = fs.readFileSync(EC_PRIVATE_KEY_PATH, "utf8");
    const ecKey = await keystore.add(ecKeyPem, "pem");
    const ecJwk = ecKey.toJSON(includePrivate) as any; // Include private key if requested

    // Create ordered JWK with or without private components
    const orderedEcJwk: EcJwk = includePrivate ? {
      crv: ecJwk.crv,
      d: ecJwk.d,
      kty: ecJwk.kty,
      use: "sig",
      x: ecJwk.x,
      y: ecJwk.y,
    } : {
      crv: ecJwk.crv,
      kty: ecJwk.kty,
      use: "sig",
      x: ecJwk.x,
      y: ecJwk.y,
    };

    return [orderedRsaJwk, orderedEcJwk];
  } catch (err) {
    console.error("Error converting keys to JWK:", (err as Error).message);
    process.exit(1);
  }
}

// Function to set secure file permissions
function setSecurePermissions(filePath: string): void {
  try {
    // 0600 = read/write for owner only
    fs.chmodSync(filePath, 0o600);
    console.log(`Secure permissions set for ${filePath}`);
  } catch (err) {
    console.error(`Error setting permissions for ${filePath}:`, (err as Error).message);
  }
}

// Interface for JWKS
interface Jwks {
  keys: JwkKey[];
}

// Main function to execute the script
async function main(): Promise<void> {
  const forceOverwrite = process.argv.includes("-f");
  const skipPublic = process.argv.includes("--no-public");

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  // Check if files already exist and handle overwrite logic
  await checkExistingFiles(forceOverwrite);

  // Step 1: Generate key pairs using OpenSSL
  generateKeys();

  // Set secure permissions for the private key files
  setSecurePermissions(RSA_PRIVATE_KEY_PATH);
  setSecurePermissions(EC_PRIVATE_KEY_PATH);

  // Step 2: Convert the generated keys into JWK format (with private components)
  const privateJwkKeys = await convertKeysToJwk(true);

  // Step 3: Construct the final private JWKS object
  const privateJwks: Jwks = {
    keys: privateJwkKeys,
  };

  // Step 4: Write the private JWKS object to a file
  const PRIVATE_JWKS_PATH = path.join(OUTPUT_DIR, "jwks.json");
  fs.writeFileSync(PRIVATE_JWKS_PATH, JSON.stringify(privateJwks, null, 2));
  setSecurePermissions(PRIVATE_JWKS_PATH);
  console.log("Private JWKS successfully created at:", PRIVATE_JWKS_PATH);

  // Step 5: Generate public JWKS (without private components) for distribution
  if (!skipPublic) {
    const publicJwkKeys = await convertKeysToJwk(false);
    const publicJwks: Jwks = {
      keys: publicJwkKeys,
    };

    const PUBLIC_JWKS_PATH = path.join(OUTPUT_DIR, "jwks.public.json");
    fs.writeFileSync(PUBLIC_JWKS_PATH, JSON.stringify(publicJwks, null, 2));
    console.log("Public JWKS successfully created at:", PUBLIC_JWKS_PATH);

    // It's safe to print the public JWKS to console
    console.log("Generated Public JWKS:");
    console.log(JSON.stringify(publicJwks, null, 2));
  } else {
    console.log("Skipping public JWKS generation as requested.");
  }

  console.log("\nWARNING: Keep your private keys and private JWKS secure!");
  console.log("Do not share the private keys or include them in your application code.");
}

// Execute the script
main();