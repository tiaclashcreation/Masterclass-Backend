# Fundamentals Integration Guide

## Overview
The fundamentals backend APIs are set up to work with your `clashcreation.com/academy/fundamentals` frontend page. This uses the same product and automation as the masterclass/secrets but without any coupon discounts - full price only.

## Backend Endpoints

### 1. Checkout Session Creation
**Endpoint:** `POST /api/fundamentals-create-checkout-session`
**Purpose:** Creates a Stripe checkout session for the fundamentals product

**Request Body:**
```json
{
  "priceId": "price_1RWAHLBlWJBhJeWF4ZXPS7eL",  // required - Stripe price ID
  "customerEmail": "user@example.com"            // optional
}
```

**Response:**
```json
{
  "sessionId": "cs_test_..."
}
```

### 2. Stripe Webhook Handler
**Endpoint:** `POST /api/fundamentals-stripe-webhook`
**Purpose:** Handles successful payments and triggers automation

**Automation Flow:**
1. Enrolls user in Kajabi via activation URL (KAJABI_ACTIVATION_URL)
2. Adds user to ConvertKit form (KIT_PURCHASE_FORM_ID)

## Frontend Integration (Next.js)

### 1. Main Page Component
Create your page at `pages/academy/fundamentals/index.js` or `app/academy/fundamentals/page.js`:

```javascript
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_live_51RHSEoBlWJBhJeWFpsXAA1VKabO5S719jxPzAOl5DcZsHxg57st273ebyoidn1lVH6IzB7ztlnVXcbdLa4wcYh3T00j80rBNQr');

export default function FundamentalsPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('https://your-backend-domain.vercel.app/api/fundamentals-create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_1RWAHLBlWJBhJeWF4ZXPS7eL', // The Viral Video Fundamentals price ID
          customerEmail: '' // optional - can capture from form
        }),
      });

             const data = await response.json();
       
       const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ 
        sessionId: data.sessionId 
      });
      
      if (error) {
        console.error('Stripe error:', error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>The Viral Video Fundamentals</h1>
      <p>Your First 1,000,000 views</p>
      
      {/* Your page content */}
      
      <button 
        onClick={handleCheckout}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Get Access Now'}
      </button>
    </div>
  );
}
```

### 2. Success Page
Create `pages/academy/fundamentals/success.js`:

```javascript
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Success() {
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    if (session_id) {
      console.log('Payment successful! Session ID:', session_id);
      // Optional: Track conversion, show specific success content
    }
  }, [session_id]);

  return (
    <div>
      <h1>Welcome to The Viral Video Fundamentals!</h1>
      <p>🎉 Payment successful! You'll receive access details shortly.</p>
      <p>Check your email for your course login information.</p>
    </div>
  );
}
```

### 3. Cancel Page
Create `pages/academy/fundamentals/cancel.js`:

```javascript
export default function Cancel() {
  return (
    <div>
      <h1>Payment Cancelled</h1>
      <p>Your payment was cancelled. You can try again anytime.</p>
      <a href="/academy/fundamentals">← Back to Fundamentals</a>
    </div>
  );
}
```

## Environment Variables Required

Add these to your backend deployment:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET_FUNDAMENTALS=whsec_...  # New webhook secret for fundamentals

# Kajabi (same as secrets)
KAJABI_ACTIVATION_URL=https://checkout.kajabi.com/webhooks/offers/...

# ConvertKit (same as secrets)
KIT_API_KEY=your_convertkit_api_key
KIT_PURCHASE_FORM_ID=8131472  # Same form as masterclass/secrets

# Domain
DOMAIN=https://clashcreation.com
```

## Stripe Configuration

### 1. Webhook Setup
In your Stripe dashboard, create a new webhook endpoint:
- **URL:** `https://your-backend-domain.vercel.app/api/fundamentals-stripe-webhook`
- **Events:** `checkout.session.completed`
- Copy the webhook secret to `STRIPE_WEBHOOK_SECRET_FUNDAMENTALS`

### 2. Pricing
No coupons or discounts - full price only.

## Product Details

- **Product:** "The Viral Video Fundamentals: Your First 1,000,000 views"
- **Price ID:** `price_1RWAHLBlWJBhJeWF4ZXPS7eL`
- **Pricing:** Full price only (no coupons)
- **Kajabi:** Same activation URL as secrets
- **ConvertKit:** Same purchase form as secrets (8131472)

## Key Features

### 💰 **Full Price Only**
- No coupons or discounts applied
- Straightforward checkout process
- Consistent pricing

### 🔄 **Same Automation as Secrets**
- Identical Kajabi enrollment
- Identical ConvertKit automation
- Same product, same course access

### 🛡️ **Error Handling**
- Detailed logging for debugging
- CORS configured for clashcreation.com

## Testing

1. **Test checkout:** Payment should show full price
2. **Test webhook:** Check Kajabi enrollment and ConvertKit subscription
3. **Test success/cancel pages:** Verify redirects work correctly

## Notes

- Same product and automation as secrets/masterclass but without coupons
- Frontend URLs are academy-specific (`/academy/fundamentals/`)
- Same backend automation and course access
- Full price checkout only 