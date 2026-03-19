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

// SSE streaming analysis — returns an abort controller so caller can cancel
export function analyzeStream(files, familyHistory, callbacks) {
  const {
    onDrishtiStart,
    onDrishtiProgress,
    onDrishtiComplete,
    onBodhiStart,
    onBodhiStep,
    onBodhiComplete,
    onMudraStart,
    onMudraComplete,
    onDone,
    onError,
  } = callbacks;

  const form = new FormData();
  files.forEach(f => form.append('files', f));
  if (familyHistory) form.append('familyHistory', JSON.stringify(familyHistory));

  const abortController = new AbortController();

  fetch(`${API_BASE}/api/analyze/stream`, {
    method: 'POST',
    body: form,
    signal: abortController.signal,
  }).then(async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            switch (currentEvent) {
              case 'drishti_start': onDrishtiStart?.(data); break;
              case 'drishti_progress': onDrishtiProgress?.(data); break;
              case 'drishti_complete': onDrishtiComplete?.(data); break;
              case 'bodhi_start': onBodhiStart?.(data); break;
              case 'bodhi_step': onBodhiStep?.(data); break;
              case 'bodhi_complete': onBodhiComplete?.(data); break;
              case 'mudra_start': onMudraStart?.(data); break;
              case 'mudra_complete': onMudraComplete?.(data); break;
              case 'done': onDone?.(data); break;
              case 'error': onError?.(data); break;
            }
          } catch { /* skip malformed JSON */ }
          currentEvent = null;
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onError?.({ message: err.message });
    }
  });

  return abortController;
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
