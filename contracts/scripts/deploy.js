const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying HealthAttestation to", hre.network.name, "...");

  const HealthAttestation = await hre.ethers.getContractFactory("HealthAttestation");
  const contract = await HealthAttestation.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("HealthAttestation deployed to:", address);

  // Save deployed address
  const deployedInfo = {
    address,
    network: "base-sepolia",
    chainId: 84532,
    deployedAt: new Date().toISOString(),
  };
  const deployedPath = path.join(__dirname, "..", "deployed-address.json");
  fs.writeFileSync(deployedPath, JSON.stringify(deployedInfo, null, 2));
  console.log("Saved deployment info to deployed-address.json");

  // Copy ABI to frontend
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "HealthAttestation.sol", "HealthAttestation.json"
  );
  const frontendAbiPath = path.join(
    __dirname, "..", "..", "frontend", "src", "contracts", "HealthAttestation.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(frontendAbiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log("Copied ABI to frontend/src/contracts/HealthAttestation.json");
  }

  // Update frontend .env with contract address
  const frontendEnvPath = path.join(__dirname, "..", "..", "frontend", ".env");
  let envContent = "";
  if (fs.existsSync(frontendEnvPath)) {
    envContent = fs.readFileSync(frontendEnvPath, "utf8");
    envContent = envContent.replace(/^VITE_CONTRACT_ADDRESS=.*$/m, `VITE_CONTRACT_ADDRESS=${address}`);
    if (!envContent.includes("VITE_CONTRACT_ADDRESS")) {
      envContent += `\nVITE_CONTRACT_ADDRESS=${address}\n`;
    }
  } else {
    envContent = `VITE_CONTRACT_ADDRESS=${address}\n`;
  }
  fs.writeFileSync(frontendEnvPath, envContent);
  console.log("Updated frontend .env with VITE_CONTRACT_ADDRESS=" + address);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
