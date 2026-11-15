"use strict";
const { getPool } = require("../database/pool");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");
const { isActivePro } = require("./pro.service");

const FEATURE_COSTS = Object.freeze({ music_search: 1, voice_to_mp3: 1 });
const roundCredit = (value) => Number(Number(value).toFixed(2));

async function deductFeatureCredit({ userId, feature }) {
  if (!userId) throw new Error("User ID is required");
  const cost = FEATURE_COSTS[feature];
  if (!Number.isFinite(cost) || cost <= 0) throw new Error("Invalid feature");
  if (await isActivePro(userId)) {
    return { isPro: true, cost: 0, balance: await creditRepository.getAvailableBalance(userId), allocations: [] };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const accounts = await creditRepository.findAvailablePackages(userId, client);
    const balance = roundCredit(accounts.reduce((sum, a) => sum + Number(a.remaining_amount || 0), 0));
    if (balance + 0.000001 < cost) {
      const error = new Error("Insufficient credit");
      error.code = "INSUFFICIENT_CREDIT";
      error.cost = cost;
      error.balance = balance;
      throw error;
    }

    let remaining = cost;
    const allocations = [];
    for (const account of accounts) {
      if (remaining <= 0.000001) break;
      const before = roundCredit(account.remaining_amount);
      if (before <= 0) continue;
      const amount = roundCredit(Math.min(before, remaining));
      const after = roundCredit(before - amount);
      await creditRepository.updateRemaining(account.id, after, client);
      await creditLedgerRepository.create({
        userId, creditAccountId: account.id, entryType: "CONSUME",
        amount: -amount, balanceBefore: before, balanceAfter: after,
        referenceType: "FEATURE", description: `Feature use: ${feature}`,
      }, client);
      allocations.push({ creditAccountId: account.id, amount });
      remaining = roundCredit(remaining - amount);
    }
    if (remaining > 0.000001) throw new Error("Credit balance changed during feature charge");
    await client.query("COMMIT");
    return { isPro: false, cost, balance: roundCredit(balance - cost), allocations };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function refundFeatureCredit({ userId, feature, charge }) {
  if (!userId || !charge || charge.isPro || !Array.isArray(charge.allocations) || !charge.allocations.length) return null;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const allocation of charge.allocations) {
      const account = await creditRepository.findByIdForUpdate(allocation.creditAccountId, client);
      if (!account) throw new Error(`Credit account not found: ${allocation.creditAccountId}`);
      const before = roundCredit(account.remaining_amount);
      const amount = roundCredit(allocation.amount);
      const after = roundCredit(before + amount);
      await creditRepository.updateRemaining(account.id, after, client);
      await creditLedgerRepository.create({
        userId, creditAccountId: account.id, entryType: "REFUND",
        amount, balanceBefore: before, balanceAfter: after,
        referenceType: "FEATURE", description: `Refund after failed feature: ${feature}`,
      }, client);
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { FEATURE_COSTS, deductFeatureCredit, refundFeatureCredit };
