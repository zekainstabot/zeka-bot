"use strict";
const { getPool } = require("../database/pool");
const referralRepository = require("../repositories/referral.repository");
const missionRepository = require("../repositories/mission.repository");
const { grantReward, grantRewardInTransaction } = require("./reward.service");

async function registerReferral(user, payload) {
 const match = String(payload || "").match(/^ref_(\d{1,18})$/);
 if (!match || !user?.id || Date.now() - new Date(user.created_at).getTime() > 5 * 60 * 1000) return false;
 const referrerId = Number(match[1]);
 if (!Number.isSafeInteger(referrerId) || referrerId === Number(user.id)) return false;
 const created = await referralRepository.create({referrerUserId:referrerId,referredUserId:user.id,referralCode:match[1]});
 return Boolean(created);
}

async function getReferralSummary(userId, botUsername) {
 const counts = await referralRepository.countByReferrer(userId);
 return { total:Number(counts.total||0), completed:Number(counts.completed||0), link:botUsername ? `https://t.me/${botUsername}?start=ref_${userId}` : null };
}

async function getMissionOverview(userId) {
 await missionRepository.ensureAssignments(userId);
 return missionRepository.listForUser(userId);
}

async function claimMissionReward(userId, userMissionId, isPro = false) {
 const pool=getPool(); const client=await pool.connect();
 try {
  await client.query("BEGIN");
  const mission=await missionRepository.findClaimable(userId,userMissionId,client);
  if (!mission) throw new Error("MISSION_NOT_CLAIMABLE");
  const multiplier=isPro ? Math.max(1,Number(mission.pro_multiplier)||1) : 1;
  const creditAmount=Number(mission.credit_reward||0)*multiplier;
  const xpAmount=Number(mission.xp_reward||0);
  const granted=await grantRewardInTransaction({userId,rewardType:"MISSION",sourceType:"MISSION",sourceId:mission.id,creditAmount,xpAmount,metadata:{missionKey:mission.mission_key,userMissionId:mission.id},client});
  if (!granted.granted && !granted.duplicate) throw new Error("MISSION_REWARD_FAILED");
  await missionRepository.markClaimed(mission.id,client);
  await client.query("COMMIT");
  return {creditAmount:granted.creditAmount,xpAmount:granted.xpAmount,duplicate:Boolean(granted.duplicate)};
 } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function recordDownloadCompleted(userId) {
 await missionRepository.ensureAssignments(userId);
 await missionRepository.addProgress(userId,"DOWNLOAD_COMPLETED",1);
 const referral=await referralRepository.findPendingByReferredUserId(userId);
 if (!referral) return;
 const reward=await grantReward({userId:referral.referrer_user_id,rewardType:"REFERRAL",sourceType:"REFERRAL",sourceId:referral.id,creditAmount:20,xpAmount:50,metadata:{referredUserId:userId}});
 if (!reward.granted && !reward.duplicate) return;
 const completed=await referralRepository.complete(referral.id,20,50);
 if (completed) { await missionRepository.ensureAssignments(referral.referrer_user_id); await missionRepository.addProgress(referral.referrer_user_id,"REFERRAL_COMPLETED",1); }
}

module.exports={registerReferral,getReferralSummary,getMissionOverview,claimMissionReward,recordDownloadCompleted};