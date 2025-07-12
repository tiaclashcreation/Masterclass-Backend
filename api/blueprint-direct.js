// blueprint-direct.js 
export default function BlueprintDirect() {
  useEffect(() => {
    // Create checkout session immediately on page load
    fetch('/api/create-blueprint-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // You can pass email if you have it from URL params
        customerEmail: new URLSearchParams(window.location.search).get('email')
      })
    })
    .then(res => res.json())
    .then(data => {
      // Redirect to Stripe checkout
      window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`;
    })
    .catch(err => {
      console.error('Error:', err);
      // Fallback to main page
      window.location.href = '/work-with-us/blueprint';
    });
  }, []);

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h2>Redirecting to checkout...</h2>
    </div>
  );
}
