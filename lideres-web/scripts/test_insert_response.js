// Usage:
// 1) Start dev server with DB disabled for a safe local test:
//    NEXT_PUBLIC_DISABLE_DB=true npm run dev
// 2) In another terminal run:
//    node ./scripts/test_insert_response.js

(async () => {
  try {
    const url = process.env.API_URL || 'http://localhost:3000/api/insert-response';
    const payload = {
      token: 'test-token-123',
      evaluatorName: 'Tester Uno',
      evaluadoNombre: 'Evaluado Ejemplo',
      evaluadoCodigo: 'EV001',
      responses: {
        A1: 'Siempre',
        A2: 'A veces'
      }
    };

    console.log('Posting to', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  }
})();
