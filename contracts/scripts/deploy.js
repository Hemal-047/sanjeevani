const hre = require("hardhat");

async function main() {
  console.log("Deploying HealthAttestation to", hre.network.name, "...");

  const HealthAttestation = await hre.ethers.getContractFactory("HealthAttestation");
  const contract = await HealthAttestation.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("HealthAttestation deployed to:", address);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
