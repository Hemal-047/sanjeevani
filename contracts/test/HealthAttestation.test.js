const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HealthAttestation", function () {
  let contract, patient, researcher, other;
  const conditionCode = ethers.encodeBytes32String("R73.03");
  const conditionName = "Pre-diabetes";
  const severity = 3; // high
  const confidence = 90;
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("glucose:126,hba1c:6.4"));

  beforeEach(async function () {
    [patient, researcher, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HealthAttestation");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  describe("Attestation Publishing", function () {
    it("should publish an attestation", async function () {
      const tx = await contract.connect(patient).publishAttestation(
        conditionCode, conditionName, severity, confidence, evidenceHash
      );
      await expect(tx).to.emit(contract, "AttestationPublished")
        .withArgs(1, patient.address, conditionCode, conditionName, severity, confidence);

      const a = await contract.getAttestation(1);
      expect(a.patient).to.equal(patient.address);
      expect(a.conditionName).to.equal("Pre-diabetes");
      expect(a.severity).to.equal(3);
      expect(a.confidence).to.equal(90);
      expect(a.active).to.be.true;
    });

    it("should reject invalid severity", async function () {
      await expect(
        contract.connect(patient).publishAttestation(conditionCode, conditionName, 0, confidence, evidenceHash)
      ).to.be.revertedWith("Invalid severity");

      await expect(
        contract.connect(patient).publishAttestation(conditionCode, conditionName, 5, confidence, evidenceHash)
      ).to.be.revertedWith("Invalid severity");
    });

    it("should reject invalid confidence", async function () {
      await expect(
        contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, 101, evidenceHash)
      ).to.be.revertedWith("Invalid confidence");
    });

    it("should track patient attestations", async function () {
      await contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, confidence, evidenceHash);
      await contract.connect(patient).publishAttestation(
        ethers.encodeBytes32String("E78.5"), "Dyslipidemia", 2, 95, evidenceHash
      );

      const ids = await contract.getPatientAttestations(patient.address);
      expect(ids.length).to.equal(2);
    });
  });

  describe("Attestation Revocation", function () {
    beforeEach(async function () {
      await contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, confidence, evidenceHash);
    });

    it("should revoke own attestation", async function () {
      const tx = await contract.connect(patient).revokeAttestation(1);
      await expect(tx).to.emit(contract, "AttestationRevoked").withArgs(1, patient.address);

      const a = await contract.getAttestation(1);
      expect(a.active).to.be.false;
    });

    it("should reject revocation by non-owner", async function () {
      await expect(
        contract.connect(other).revokeAttestation(1)
      ).to.be.revertedWith("Not your attestation");
    });

    it("should reject double revocation", async function () {
      await contract.connect(patient).revokeAttestation(1);
      await expect(
        contract.connect(patient).revokeAttestation(1)
      ).to.be.revertedWith("Already revoked");
    });
  });

  describe("Query by Condition", function () {
    it("should return attestation IDs for a condition code", async function () {
      await contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, confidence, evidenceHash);
      await contract.connect(researcher).publishAttestation(conditionCode, "Pre-diabetes", 2, 80, evidenceHash);

      const ids = await contract.queryByCondition(conditionCode);
      expect(ids.length).to.equal(2);
    });
  });

  describe("Trial Invitation Flow", function () {
    beforeEach(async function () {
      await contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, confidence, evidenceHash);
    });

    it("should send a trial invitation with ETH", async function () {
      const compensation = ethers.parseEther("0.1");
      const tx = await contract.connect(researcher).sendTrialInvitation(
        1, "Diabetes Prevention Study", "12-week lifestyle intervention",
        { value: compensation }
      );
      await expect(tx).to.emit(contract, "TrialInvitationSent")
        .withArgs(1, researcher.address, patient.address, 1, "Diabetes Prevention Study");

      const inv = await contract.trialInvitations(1);
      expect(inv.compensation).to.equal(compensation);
      expect(inv.active).to.be.true;
    });

    it("should reject invitation without ETH", async function () {
      await expect(
        contract.connect(researcher).sendTrialInvitation(1, "Study", "Desc", { value: 0 })
      ).to.be.revertedWith("Must include compensation");
    });

    it("should accept invitation and transfer ETH to patient", async function () {
      const compensation = ethers.parseEther("0.1");
      await contract.connect(researcher).sendTrialInvitation(
        1, "Study", "Desc", { value: compensation }
      );

      const balBefore = await ethers.provider.getBalance(patient.address);
      const tx = await contract.connect(patient).acceptTrialInvitation(1);
      await expect(tx).to.emit(contract, "TrialInvitationAccepted").withArgs(1, patient.address, compensation);

      const balAfter = await ethers.provider.getBalance(patient.address);
      // Balance increased (minus gas)
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should decline invitation and refund researcher", async function () {
      const compensation = ethers.parseEther("0.1");
      await contract.connect(researcher).sendTrialInvitation(
        1, "Study", "Desc", { value: compensation }
      );

      const balBefore = await ethers.provider.getBalance(researcher.address);
      const tx = await contract.connect(patient).declineTrialInvitation(1);
      await expect(tx).to.emit(contract, "InvitationDeclined").withArgs(1, patient.address);

      const balAfter = await ethers.provider.getBalance(researcher.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should reject accept by non-patient", async function () {
      const compensation = ethers.parseEther("0.1");
      await contract.connect(researcher).sendTrialInvitation(
        1, "Study", "Desc", { value: compensation }
      );

      await expect(
        contract.connect(other).acceptTrialInvitation(1)
      ).to.be.revertedWith("Not your invitation");
    });

    it("should track patient invitations", async function () {
      await contract.connect(researcher).sendTrialInvitation(
        1, "Study A", "Desc", { value: ethers.parseEther("0.1") }
      );
      await contract.connect(researcher).sendTrialInvitation(
        1, "Study B", "Desc", { value: ethers.parseEther("0.2") }
      );

      const ids = await contract.getPatientInvitations(patient.address);
      expect(ids.length).to.equal(2);
    });
  });

  describe("Data Purchase Flow", function () {
    beforeEach(async function () {
      await contract.connect(patient).publishAttestation(conditionCode, conditionName, severity, confidence, evidenceHash);
    });

    it("should request data purchase with ETH", async function () {
      const price = ethers.parseEther("0.05");
      const tx = await contract.connect(researcher).requestDataPurchase(
        1, "Full lab report data", { value: price }
      );
      await expect(tx).to.emit(contract, "DataPurchaseRequested")
        .withArgs(1, researcher.address, patient.address, 1, price);

      const req = await contract.dataPurchaseRequests(1);
      expect(req.priceOffered).to.equal(price);
      expect(req.active).to.be.true;
    });

    it("should reject purchase without ETH", async function () {
      await expect(
        contract.connect(researcher).requestDataPurchase(1, "Data", { value: 0 })
      ).to.be.revertedWith("Must include payment");
    });

    it("should accept purchase and transfer ETH to patient", async function () {
      const price = ethers.parseEther("0.05");
      await contract.connect(researcher).requestDataPurchase(
        1, "Full lab data", { value: price }
      );

      const balBefore = await ethers.provider.getBalance(patient.address);
      const tx = await contract.connect(patient).acceptDataPurchase(1);
      await expect(tx).to.emit(contract, "DataPurchaseAccepted").withArgs(1, patient.address, price);

      const balAfter = await ethers.provider.getBalance(patient.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should decline purchase and refund researcher", async function () {
      const price = ethers.parseEther("0.05");
      await contract.connect(researcher).requestDataPurchase(
        1, "Full lab data", { value: price }
      );

      const balBefore = await ethers.provider.getBalance(researcher.address);
      const tx = await contract.connect(patient).declineDataPurchase(1);
      await expect(tx).to.emit(contract, "PurchaseDeclined").withArgs(1, patient.address);

      const balAfter = await ethers.provider.getBalance(researcher.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should reject accept by non-patient", async function () {
      const price = ethers.parseEther("0.05");
      await contract.connect(researcher).requestDataPurchase(
        1, "Data", { value: price }
      );

      await expect(
        contract.connect(other).acceptDataPurchase(1)
      ).to.be.revertedWith("Not your request");
    });

    it("should track patient purchase requests", async function () {
      await contract.connect(researcher).requestDataPurchase(
        1, "Data A", { value: ethers.parseEther("0.05") }
      );
      await contract.connect(other).requestDataPurchase(
        1, "Data B", { value: ethers.parseEther("0.1") }
      );

      const ids = await contract.getPatientPurchaseRequests(patient.address);
      expect(ids.length).to.equal(2);
    });
  });
});
