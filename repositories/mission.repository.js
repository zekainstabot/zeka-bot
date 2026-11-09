"use strict";
const { getClient } = require("../database/client");
async function ensureAssignments(userId) {
 await getClient().query("INSERT INTO user_missions (user_id,mission_id,progress,target_value,status,started_at) SELECT $1,m.id,0,m.target_value,'ACTIVE',CASE WHEN m.mission_type='DAILY' THEN date_trunc('day',NOW()) ELSE TIMESTAMPTZ '2000-01-01 00:00:00+00' END FROM missions m WHERE m.status='ACTIVE' AND (m.starts_at IS NULL OR m.starts_at<=NOW()) AND (m.ends_at IS NULL OR m.ends_at>NOW()) ON CONFLICT (user_id,mission_id,started_at) DO NOTHING",[userId]);
}
async function listForUser(userId) {
 const r=await getClient().query("SELECT um.id AS user_mission_id,um.progress,um.target_value,um.status AS user_status,um.claimed_at,m.mission_key,m.title_key,m.description_key,m.mission_type,m.credit_reward,m.xp_reward,m.pro_multiplier FROM user_missions um JOIN missions m ON m.id=um.mission_id WHERE um.user_id=$1 AND m.status='ACTIVE' AND (um.expires_at IS NULL OR um.expires_at>NOW()) AND (m.mission_type<>'DAILY' OR um.started_at>=date_trunc('day',NOW())) ORDER BY m.id",[userId]);
 return r.rows;
}
async function addProgress(userId,targetType,amount=1) {
 const r=await getClient().query("UPDATE user_missions um SET progress=LEAST(um.target_value,um.progress+$3),status=CASE WHEN um.progress+$3>=um.target_value THEN 'COMPLETED' ELSE 'ACTIVE' END,completed_at=CASE WHEN um.progress+$3>=um.target_value THEN COALESCE(um.completed_at,NOW()) ELSE um.completed_at END,updated_at=NOW() FROM missions m WHERE um.mission_id=m.id AND um.user_id=$1 AND m.target_type=$2 AND m.status='ACTIVE' AND um.status='ACTIVE' AND (um.expires_at IS NULL OR um.expires_at>NOW()) AND (m.mission_type<>'DAILY' OR um.started_at>=date_trunc('day',NOW())) RETURNING um.id",[userId,targetType,Math.max(0,Number(amount)||0)]);
 return r.rowCount;
}
async function findClaimable(userId,id,client) { const db=client||getClient(); const r=await db.query("SELECT um.*,m.mission_key,m.credit_reward,m.xp_reward,m.pro_multiplier FROM user_missions um JOIN missions m ON m.id=um.mission_id WHERE um.id=$1 AND um.user_id=$2 AND um.status='COMPLETED' AND um.claimed_at IS NULL FOR UPDATE OF um",[id,userId]); return r.rows[0]||null; }
async function markClaimed(id,client) { const db=client||getClient(); const r=await db.query("UPDATE user_missions SET claimed_at=NOW(),status='CLAIMED',updated_at=NOW() WHERE id=$1 AND claimed_at IS NULL RETURNING *",[id]); return r.rows[0]||null; }
module.exports={ensureAssignments,listForUser,addProgress,findClaimable,markClaimed};