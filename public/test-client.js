console.log('External test script executed');
try {
  const el = document.getElementById('client-bullet');
  if (el) el.textContent = 'External script executed — external JS active';
} catch (e) {
  console.error('test-client.js error', e);
}