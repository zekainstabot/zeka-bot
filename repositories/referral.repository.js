"use strict";
const { getClient } = require("../database/client");
async function create({ referrerUserId, referredUserId, referralCode }) {
 const db=getClient();
 const r=await db.query("INSERT INTO referrals (referrer_user_id,referred_user_id,referral_code,status) VALUES ($1,$2,$3,'PENDING') ON CONFLICT (referred_user_id) DO NOTHING RETURNING *",[referrerUserId,referredUserId,referralCode]);
 return r.rows[0] || null;
}
async function findPendingByReferredUserId(id) { const r=await getClient().query("SELECT * FROM referrals WHERE referred_user_id=$1 AND status='PENDING' LIMIT 1",[id]); return r.rows[0] || null; }
async function countByReferrer(id) { const r=await getClient().query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed FROM referrals WHERE referrer_user_id=$1",[id]); return r.rows[0] || {total:0,completed:0}; }
async function complete(id, credit=20, xp=50) { const r=await getClient().query("UPDATE referrals SET status='COMPLETED',reward_granted=TRUE,reward_credit_amount=$2,reward_xp=$3,completed_at=NOW() WHERE id=$1 AND status='PENDING' RETURNING *",[id,credit,xp]); return r.rows[0] || null; }
module.exports={create,findPendingByReferredUserId,countByReferrer,complete};