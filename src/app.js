const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { Op, Sequelize } = require("sequelize");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

// API route to return the contract only if it belongs to the calling profile.
// GET /contracts/:id
app.get("/contracts/:id", getProfile, async (req, res) => {
  // Retrieve necessary models and user profile
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  const { profile } = req;

  try {
    // Find the contract that matches the ID and involves the calling user
    const contract = await Contract.findOne({
      where: {
        id,
        [Sequelize.Op.or]: [
          { ContractorId: profile.id },
          { ClientId: profile.id },
        ],
      },
    });
    // Return the contract if found, or a 404 error if not
    if (!contract)
      return res.status(404).json({ error: "No valid contract" }).end();
    res.status(200).json(contract);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Returns a list of non-terminated contracts belonging to a user (client or contractor).
// GET /contracts
app.get("/contracts", getProfile, async (req, res) => {
  // Retrieve necessary models and user profile
  const { Contract } = req.app.get("models");
  const { profile } = req;

  try {
    // Find contracts involving the user that are not terminated
    const contracts = await Contract.findAll({
      where: {
        [Sequelize.Op.or]: [{ ContractorId: profile.id }, { ClientId: profile.id }],
        status: { [Sequelize.Op.not]: 'terminated' },
      },
    });

    // Return the list of contracts
    res.status(200).json(contracts);
  } catch (error) {
    // Handle internal server error
    res.status(500).json({ error: 'Internal server error' });
  }
  });

// Get all unpaid jobs for a user (either a client or contractor), for active contracts only.
// GET /jobs/unpaid
app.get("/jobs/unpaid", getProfile, async (req, res) => {
  // Retrieve necessary models and user profile
  const { Job, Contract} = req.app.get("models");
  const { profile } = req;
  try {
    // Find unpaid jobs that are associated with active contracts involving the user
    const unpaidJobs = await Job.findAll({
      where: {
        paid: 0,
      },
      include: [
        {
          model: Contract,
          where: {
            [Sequelize.Op.or]: [
              { ContractorId: profile.id },
              { ClientId: profile.id },
            ],
            status: { [Sequelize.Op.not]: "terminated" },
          },
        },
      ],
    });
    // Return the list of unpaid jobs
    res.status(200).json(unpaidJobs);
  } catch (error) {
    // Handle internal server error
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Pay for a job, a client can only pay if their balance >= the amount to pay.
// The amount should be moved from the client's balance to the contractor's balance.
// POST /jobs/:job_id/pay
app.post("/jobs/:job_id/pay", getProfile, async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { profile } = req;
  const { job_id } = req.params;

  try {
    // Find the job by ID that is unpaid and associated with the user's contract
    const job = await Job.findOne({
      where: { id: job_id, paid: false },
      include: [
        {
          model: Contract,
          where: {
            ClientId: profile.id,
            status: { [Sequelize.Op.not]: "terminated" },
          },
        },
      ],
    });

    if (!job) return res.status(404).end();

    const { price } = job;
    // Check if the client's balance is sufficient for the payment
    if (profile.balance < price) {
      return res
        .status(400)
        .json({ error: "Insufficient balance to pay for the job" });
    }

    // Deduct the amount from the client's balance and mark the job as paid
    await Profile.update(
      { balance: profile.balance - price },
      { where: { id: profile.id } }
    );
    await job.update({ paid: true, paymentDate: new Date() });
    // Return a success message
    res.status(200).json({ message: "Payment successful" });
  } catch (error) {
    // Handle internal server error
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deposits money into a client's balance, limited to 25% of their total job payment.
// POST /balances/deposit/:userId
app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { Profile, Job, Contract, sequelize } = req.app.get("models"); 
  const { profile } = req;
  try {
    var contract_ids = new Array();
    const { Contract, Job, Profile } = req.app.get("models");
    const user_id = req.params.userId;
    var deposit_amount = req.body.amount;
    // Check if the user is depositing into their own balance
    if (profile.id !== parseInt(user_id)) {
      return res
        .status(403)
        .json({
          error: "Forbidden: You can only deposit into your own balance",
        });
    }
  // Find contracts associated with the user
    const contract_details = await Contract.findAll({
      where: {
        ClientId: user_id,
      },
    });
     // Store the IDs of the contracts
    for (var contract of contract_details) {
      contract_ids.push(contract.id);
    }
    // Calculate the allowable deposit amount based on contract prices
    price_details = await Job.findOne({
      attributes: [
        [Sequelize.fn("SUM", Sequelize.col("Job.price")), "totalPrice"],
      ],
      where: {
        ContractId: {
          [Op.in]: contract_ids,
        },
      },
    });
    // Check if the deposit amount is within the allowable limit
    allowable_amount = price_details.dataValues.totalPrice * 0.25;
    if (deposit_amount <= allowable_amount) {
      await Profile.update(
        { balance: deposit_amount },
        {
          where: {
            id: user_id,
          },
        }
      );
      res.json("Amount credited to your balance successfully");
    } else {
      res.json(
        "Deposit amount is greater than allowable limit: " + allowable_amount
      );
    }
  } catch (error) {
     // Handle internal server error
     res.status(500).json({ error: "Internal server error" });
    console.log("Error occurred while depositing amount" + error);
  }
});
// Returns the profession that earned the most money (sum of jobs paid) for any contractor
// that worked in the query time range.
// GET /admin/best-profession?start=<date>&end=<date>
app.get("/admin/best-profession", async (req, res) => {
  try {
    var date_range = new Array();
    date_range.push(req.query.start);
    date_range.push(req.query.end);
    if (req.query.start === undefined || req.query.end === undefined) {
      return res.status(404).end();
    }

    const { Job } = req.app.get("models");
    job_details = await Job.findOne({
      order: [[sequelize.fn("max", sequelize.col("Job.price")), "DESC"]],
      attributes: [
        "ContractId",
        [Sequelize.fn("SUM", Sequelize.col("Job.price")), "totalPrice"],
      ],
      group: "ContractId",
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: date_range,
        },
      },
    });
    if (job_details.length === 0) {
      return res.status(404).json({ error: "No data found" });
    }
    const contract = await job_details.getContract();
    const profile = await contract.getContractor();
    res.status(200).json(profile);
  } catch (error) {
    console.log("Error occurred while getting profiles" + error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Returns the clients who paid the most for jobs in the query time period, with an optional limit.
// GET /admin/best-clients?start=<date>&end=<date>&limit=<integer>
app.get("/admin/best-clients", async (req, res) => {
  try {
    if (req.query.start === undefined || req.query.end === undefined) {
      return res.status(500).end();
    }
    var date_range = new Array();
    var clients_list = new Array();
    var limit = req.query.limit || 2;
    date_range.push(req.query.start);
    date_range.push(req.query.end);
// Retrieve necessary models and user profile
    const { Job } = req.app.get("models");
    job_details = await Job.findAll({
      limit: limit,
      order: [[sequelize.fn("max", sequelize.col("Job.price")), "DESC"]],
      attributes: [
        "ContractId",
        [Sequelize.fn("SUM", Sequelize.col("Job.price")), "totalPrice"],
      ],
      group: "ContractId",
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: date_range,
        },
      },
    });
    for (var job of job_details) {
      contract = await job?.getContract();
      client = await contract.getClient();
      clients_list.push(client);
    }
    const transformedList = clients_list.map((client) => ({
      id: client.id,
      fullName: `${client.firstName} ${client.lastName}`,
      paid: client.balance, 
    }));
    res.status(200).json(transformedList);
  } catch (error) {
    console.log("Error occurred while getting profiles" + error);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = app;
