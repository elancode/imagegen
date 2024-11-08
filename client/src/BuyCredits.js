import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Box,
  Button,
  Typography,
  Grid,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function BuyCredits({ onClose }) {
  const initiateCheckout = async (priceId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const session = await response.json();
      const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
      await stripe.redirectToCheckout({ sessionId: session.id });
    } catch (error) {
      console.error('Error initiating checkout:', error);
    }
  };

  return (
    <Box sx={{ padding: 2 }}>
      {/* Back Button at the Top */}
      <Box sx={{ marginBottom: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onClose}
        >
          Back
        </Button>
      </Box>



      {/* Products Grid */}
      <Grid container spacing={3} justifyContent="center">
        {/* Trial Pack */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Trial Pack</Typography>
            <Typography variant="h6" gutterBottom>$15</Typography>
            <Typography variant="body1" gutterBottom>
              1 model credit and 25 image credits
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => initiateCheckout('price_1QIXMTFhmSaLvSL4WOcqXSzG')}
              sx={{ marginTop: 2, borderRadius: 1 }}
              fullWidth
            >
              Choose
            </Button>
          </Paper>
        </Grid>

        {/* Standard Plan */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Standard Plan</Typography>
            <Typography variant="h6" gutterBottom>$25 / month</Typography>
            <Typography variant="body1" gutterBottom>
              2 model credits and 50 image credits each month
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => initiateCheckout('price_1QIXrAFhmSaLvSL43cZ0UMMM')}
              sx={{ marginTop: 2, borderRadius: 1 }}
              fullWidth
            >
              Choose
            </Button>
          </Paper>
        </Grid>

        {/* Premium Plan */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Premium Plan</Typography>
            <Typography variant="h6" gutterBottom>$40 / month</Typography>
            <Typography variant="body1" gutterBottom>
              4 model credits and 200 image credits each month
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => initiateCheckout('price_1QIXsNFhmSaLvSL43RiC9dDv')}
              sx={{ marginTop: 2, borderRadius: 1 }}
              fullWidth
            >
              Choose
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BuyCredits;