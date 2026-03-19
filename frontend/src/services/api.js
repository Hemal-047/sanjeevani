const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
  return data;
}

export async function healthCheck() {
  return request('/api/health');
}

export async function analyzeDocument(file, documentType = 'auto') {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const res = await fetch(`${API_BASE}/api/analyze/document`, { method: 'POST', body: form });
  return res.json();
}

export async function analyzeBatch(files) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${API_BASE}/api/analyze/batch`, { method: 'POST', body: form });
  return res.json();
}

export async function analyzeComprehensive(files, familyHistory = null) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  if (familyHistory) form.append('familyHistory', JSON.stringify(familyHistory));
  const res = await fetch(`${API_BASE}/api/analyze/comprehensive`, { method: 'POST', body: form });
  return res.json();
}

export async function prepareAttestations(bodhiOutput) {
  return request('/api/attestation/prepare', {
    method: 'POST',
    body: JSON.stringify({ bodhiOutput }),
  });
}

export async function getPatientProfile(attestations) {
  return request('/api/marketplace/patient-profile', {
    method: 'POST',
    body: JSON.stringify({ attestations }),
  });
}

export async function searchResearcher(criteria, attestations) {
  return request('/api/marketplace/search', {
    method: 'POST',
    body: JSON.stringify({ criteria, attestations }),
  });
}

export async function sendInvite(data) {
  return request('/api/marketplace/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function sendPurchaseRequest(data) {
  return request('/api/marketplace/purchase-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
