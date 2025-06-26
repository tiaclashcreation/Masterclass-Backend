# Blueprint Integration Guide

## Overview
The blueprint backend APIs are set up to work with your `clashcreation.com/work-with-us/blueprint` frontend page. This uses the same product and automation flow as the "creator" product but with blueprint-specific endpoints.

## Backend Endpoints

### 1. Checkout Session Creation
**Endpoint:** `POST /api/blueprint-create-checkout-session`
**Purpose:** Creates a Stripe checkout session for the blueprint product

**Request Body:**
```json
{
  "customerEmail": "user@example.com"  // optional
}
```

**Response:**
```json
{
  "sessionId": "cs_test_..."
}
```

### 2. Stripe Webhook Handler
**Endpoint:** `POST /api/blueprint-stripe-webhook`
**Purpose:** Handles successful payments and triggers automation

**Automation Flow:**
1. Enrolls user in Kajabi offer (same as creator: offer ID 2150421081)
2. Adds user to ConvertKit form (form ID 8189148)

### 3. Download Kit (Optional)
**Endpoint:** `POST /api/blueprint-download-kit`
**Purpose:** Allows users to download a kit/resource before purchase

**Request Body:**
```json
{
  "email": "user@example.com",     // required
  "firstName": "John"              // optional
}
```

## Frontend Integration

### 1. Payment Flow
Your frontend should call the checkout session endpoint:

```javascript
// Example frontend code
const createCheckoutSession = async () => {
  const response = await fetch('https://your-backend-domain.vercel.app/api/blueprint-create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerEmail: userEmail // optional
    }),
  });
  
  const { sessionId } = await response.json();
  
  // Redirect to Stripe Checkout
  const stripe = Stripe('pk_live_...');
  await stripe.redirectToCheckout({ sessionId });
};
```

### 2. Success/Cancel Pages
The backend is configured to redirect to:
- Success: `https://clashcreation.com/work-with-us/blueprint/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://clashcreation.com/work-with-us/blueprint/cancel`

Make sure these pages exist on your frontend.

## Environment Variables Required

Add these to your backend deployment:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET_BLUEPRINT=whsec_...  # New webhook secret for blueprint

# ConvertKit
KIT_API_KEY=your_convertkit_api_key

# Existing variables (if not already set)
DOMAIN=https://clashcreation.com
```

## Stripe Webhook Configuration

In your Stripe dashboard, create a new webhook endpoint:
- URL: `https://your-backend-domain.vercel.app/api/blueprint-stripe-webhook`
- Events: `checkout.session.completed`
- Copy the webhook secret to `STRIPE_WEBHOOK_SECRET_BLUEPRINT`

## Product Details

- **Product:** Blueprint Program
- **Price:** £2135 (GBP only, fixed price)
- **Payment:** One-time payment, no subscriptions
- **Kajabi Offer:** 2150421081 (same as creator)
- **ConvertKit Form:** 8189148 (same as creator)

## Notes

- Blueprint has its own fixed pricing: £2135 (GBP only)
- Uses dynamic price creation (no pre-created Stripe price IDs needed)
- Same automation as creator (Kajabi + ConvertKit)
- Frontend URLs are blueprint-specific (`/work-with-us/blueprint/`)
- Simplified payment flow - no currency selection needed 