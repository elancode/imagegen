import React from 'react';
import { Container, Typography, Box } from '@mui/material';

function TermsOfService() {
    return (
        <Container maxWidth="md">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Terms of Service
                </Typography>
                <Typography variant="body1" paragraph>
                    Welcome to our application. By using our service, you agree to the following terms...
                </Typography>
                {/* Add more terms content here */}
            </Box>
        </Container>
    );
}

export default TermsOfService; 