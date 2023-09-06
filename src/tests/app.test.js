const { expect } = require('chai');
const request = require('supertest');
const app = require('../app'); // Import your Express app

describe('Express App Unit Tests', () => {
  // Define a sample profile for testing purposes
  const sampleProfile = {
    id: 1,
    balance: 1000, // Set an initial balance for testing
  };

  // Mock the getProfile middleware
  app.use((req, res, next) => {
    req.profile = sampleProfile; // Assign the sample profile to req.profile
    next();
  });

  // Test the GET /contracts/:id endpoint
  describe('GET /contracts/:id', () => {
    it('should return a contract by ID', async () => {
      const response = await request(app)
        .get('/contracts/1') // Replace with a valid contract ID for testing
        .set('profile_id', 1); // Simulate the user profile
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
    });

    it('should return a 404 status for a non-existent contract', async () => {
      const response = await request(app)
        .get('/contracts/999') // Replace with a non-existent contract ID
        .set('profile_id', 1); // Simulate the user profile
      expect(response.status).to.equal(404);
    });
  });

  // Test the GET /contracts endpoint
  describe('GET /contracts', () => {
    it('should return a list of contracts', async () => {
      const response = await request(app)
        .get('/contracts')
        .set('profile_id', 1); // Simulate the user profile
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });

    it('should return a 404 status for a non-existent contract', async () => {
      const response = await request(app)
        .get('/contracts/999') // Replace with a non-existent contract ID
        .set('profile_id', 1); // Simulate the user profile
      expect(response.status).to.equal(404);
    });
  });

  // Test the GET /jobs/unpaid endpoint
  describe('GET /jobs/unpaid', () => {
    it('should return unpaid jobs', async () => {
      const response = await request(app)
        .get('/jobs/unpaid')
        .set('profile_id', 10); // Simulate the user profile
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });
  });

  // Test the POST /jobs/:job_id/pay endpoint
  describe('POST /jobs/:job_id/pay', () => {
    it('should make a payment for a job', async () => {
      const response = await request(app)
        .post('/jobs/16/pay') 
        .set('profile_id', 10); // Simulate the user profile
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message', 'Payment successful');
    });

    it('should return a 404 status for a non-existent job', async () => {
      const response = await request(app)
        .post('/jobs/999/pay') // Replace with a non-existent job ID
        .set('profile_id', 1); // Simulate the user profile
      expect(response.status).to.equal(404);
    });
  });
 // Test the POST /balances/deposit/:userId endpoint
 describe('POST /balances/deposit/:userId', () => {
    it('should deposit funds into the user\'s balance', async () => {
      const depositAmount = 10;
      const response = await request(app)
        .post('/balances/deposit/9') 
        .set('profile_id', 9) // Simulate the user profile
        .send({ amount: depositAmount });
      expect(response.status).to.equal(200);
      
    });
    it('should return a 403 status for depositing into another user\'s balance', async () => {
      const response = await request(app)
        .post('/balances/deposit/2') // Replace with a different user ID
        .set('profile_id', 1) // Simulate the user profile
        .send({ amount: 100 });
      expect(response.status).to.equal(403);
    });
  });
  // Test the GET /admin/best-profession endpoint
  describe('GET /admin/best-profession', () => {
    it('should return the best profession', async () => {
      const response = await request(app)
        .get('/admin/best-profession?start=2023-01-01&end=2023-12-31');
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
    });

    it('should return a 404 status for no data found', async () => {
      const response = await request(app)
        .get('/admin/best-profession?start=2021-01-01end=2022-12-31'); // Missing separator in the query
      expect(response.status).to.equal(404);
    });
  });

 

  // Test the GET /admin/best-clients endpoint
  describe('GET /admin/best-clients', () => {
    it('should return a list of best clients', async () => {
      const response = await request(app)
        .get('/admin/best-clients?start=2023-01-01&end=2023-12-31');
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });

    it('should return a 500 status for internal server error', async () => {
      // Simulate an error by not providing valid query parameters
      const response = await request(app).get('/admin/best-clients?start=12-08-19');
      expect(response.status).to.equal(500);
    });
  });
});
