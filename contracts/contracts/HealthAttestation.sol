// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HealthAttestation is ReentrancyGuard {
    struct Attestation {
        address patient;
        bytes32 conditionCode;
        string conditionName;
        uint8 severity; // 1=low, 2=moderate, 3=high, 4=critical
        uint8 confidence; // 0-100
        bytes32 evidenceHash;
        uint256 timestamp;
        bool active;
    }

    struct TrialInvitation {
        address researcher;
        address patient;
        uint256 attestationId;
        string studyName;
        string description;
        uint256 compensation;
        bool accepted;
        bool active;
    }

    struct DataPurchaseRequest {
        address researcher;
        address patient;
        uint256 attestationId;
        string dataRequested;
        uint256 priceOffered;
        bool accepted;
        bool active;
    }

    // Counters
    uint256 private _nextAttestationId = 1;
    uint256 private _nextInvitationId = 1;
    uint256 private _nextPurchaseId = 1;

    // Storage
    mapping(uint256 => Attestation) public attestations;
    mapping(address => uint256[]) private _patientAttestations;
    mapping(bytes32 => uint256[]) private _conditionAttestations;

    mapping(uint256 => TrialInvitation) public trialInvitations;
    mapping(address => uint256[]) private _patientInvitations;

    mapping(uint256 => DataPurchaseRequest) public dataPurchaseRequests;
    mapping(address => uint256[]) private _patientPurchaseRequests;

    // Events
    event AttestationPublished(uint256 indexed attestationId, address indexed patient, bytes32 conditionCode, string conditionName, uint8 severity, uint8 confidence);
    event AttestationRevoked(uint256 indexed attestationId, address indexed patient);
    event TrialInvitationSent(uint256 indexed invitationId, address indexed researcher, address indexed patient, uint256 attestationId, string studyName);
    event TrialInvitationAccepted(uint256 indexed invitationId, address indexed patient, uint256 compensation);
    event InvitationDeclined(uint256 indexed invitationId, address indexed patient);
    event DataPurchaseRequested(uint256 indexed purchaseId, address indexed researcher, address indexed patient, uint256 attestationId, uint256 priceOffered);
    event DataPurchaseAccepted(uint256 indexed purchaseId, address indexed patient, uint256 payment);
    event PurchaseDeclined(uint256 indexed purchaseId, address indexed patient);

    // --- Attestation Functions ---

    function publishAttestation(
        bytes32 conditionCode,
        string calldata conditionName,
        uint8 severity,
        uint8 confidence,
        bytes32 evidenceHash
    ) external returns (uint256) {
        require(severity >= 1 && severity <= 4, "Invalid severity");
        require(confidence <= 100, "Invalid confidence");

        uint256 id = _nextAttestationId++;
        attestations[id] = Attestation({
            patient: msg.sender,
            conditionCode: conditionCode,
            conditionName: conditionName,
            severity: severity,
            confidence: confidence,
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            active: true
        });

        _patientAttestations[msg.sender].push(id);
        _conditionAttestations[conditionCode].push(id);

        emit AttestationPublished(id, msg.sender, conditionCode, conditionName, severity, confidence);
        return id;
    }

    function revokeAttestation(uint256 attestationId) external {
        Attestation storage a = attestations[attestationId];
        require(a.patient == msg.sender, "Not your attestation");
        require(a.active, "Already revoked");

        a.active = false;
        emit AttestationRevoked(attestationId, msg.sender);
    }

    function getAttestation(uint256 attestationId) external view returns (Attestation memory) {
        return attestations[attestationId];
    }

    function queryByCondition(bytes32 conditionCode) external view returns (uint256[] memory) {
        return _conditionAttestations[conditionCode];
    }

    function getPatientAttestations(address patient) external view returns (uint256[] memory) {
        return _patientAttestations[patient];
    }

    // --- Trial Invitation Functions ---

    function sendTrialInvitation(
        uint256 attestationId,
        string calldata studyName,
        string calldata description
    ) external payable returns (uint256) {
        Attestation storage a = attestations[attestationId];
        require(a.active, "Attestation not active");
        require(msg.value > 0, "Must include compensation");

        uint256 id = _nextInvitationId++;
        trialInvitations[id] = TrialInvitation({
            researcher: msg.sender,
            patient: a.patient,
            attestationId: attestationId,
            studyName: studyName,
            description: description,
            compensation: msg.value,
            accepted: false,
            active: true
        });

        _patientInvitations[a.patient].push(id);

        emit TrialInvitationSent(id, msg.sender, a.patient, attestationId, studyName);
        return id;
    }

    function acceptTrialInvitation(uint256 invitationId) external nonReentrant {
        TrialInvitation storage inv = trialInvitations[invitationId];
        require(inv.patient == msg.sender, "Not your invitation");
        require(inv.active, "Invitation not active");
        require(!inv.accepted, "Already accepted");

        inv.accepted = true;
        inv.active = false;

        (bool sent, ) = payable(msg.sender).call{value: inv.compensation}("");
        require(sent, "Transfer failed");

        emit TrialInvitationAccepted(invitationId, msg.sender, inv.compensation);
    }

    function declineTrialInvitation(uint256 invitationId) external nonReentrant {
        TrialInvitation storage inv = trialInvitations[invitationId];
        require(inv.patient == msg.sender, "Not your invitation");
        require(inv.active, "Invitation not active");

        inv.active = false;

        (bool sent, ) = payable(inv.researcher).call{value: inv.compensation}("");
        require(sent, "Refund failed");

        emit InvitationDeclined(invitationId, msg.sender);
    }

    function getPatientInvitations(address patient) external view returns (uint256[] memory) {
        return _patientInvitations[patient];
    }

    // --- Data Purchase Functions ---

    function requestDataPurchase(
        uint256 attestationId,
        string calldata dataRequested
    ) external payable returns (uint256) {
        Attestation storage a = attestations[attestationId];
        require(a.active, "Attestation not active");
        require(msg.value > 0, "Must include payment");

        uint256 id = _nextPurchaseId++;
        dataPurchaseRequests[id] = DataPurchaseRequest({
            researcher: msg.sender,
            patient: a.patient,
            attestationId: attestationId,
            dataRequested: dataRequested,
            priceOffered: msg.value,
            accepted: false,
            active: true
        });

        _patientPurchaseRequests[a.patient].push(id);

        emit DataPurchaseRequested(id, msg.sender, a.patient, attestationId, msg.value);
        return id;
    }

    function acceptDataPurchase(uint256 purchaseId) external nonReentrant {
        DataPurchaseRequest storage req = dataPurchaseRequests[purchaseId];
        require(req.patient == msg.sender, "Not your request");
        require(req.active, "Request not active");
        require(!req.accepted, "Already accepted");

        req.accepted = true;
        req.active = false;

        (bool sent, ) = payable(msg.sender).call{value: req.priceOffered}("");
        require(sent, "Transfer failed");

        emit DataPurchaseAccepted(purchaseId, msg.sender, req.priceOffered);
    }

    function declineDataPurchase(uint256 purchaseId) external nonReentrant {
        DataPurchaseRequest storage req = dataPurchaseRequests[purchaseId];
        require(req.patient == msg.sender, "Not your request");
        require(req.active, "Request not active");

        req.active = false;

        (bool sent, ) = payable(req.researcher).call{value: req.priceOffered}("");
        require(sent, "Refund failed");

        emit PurchaseDeclined(purchaseId, msg.sender);
    }

    function getPatientPurchaseRequests(address patient) external view returns (uint256[] memory) {
        return _patientPurchaseRequests[patient];
    }
}
