INSERT INTO missions (mission_key,title_key,description_key,mission_type,target_type,target_value,credit_reward,xp_reward,pro_multiplier,status,config)
VALUES
('first_download','اولین دانلود','اولین فایل را با موفقیت دانلود کن','ONCE','DOWNLOAD_COMPLETED',1,10,25,2,'ACTIVE','{}'::jsonb),
('download_3','دانلودگر فعال','۳ دانلود موفق انجام بده','ONCE','DOWNLOAD_COMPLETED',3,30,75,2,'ACTIVE','{}'::jsonb),
('invite_friend','دعوت از دوستان','یک دوست را دعوت کن تا اولین دانلودش را انجام دهد','ONCE','REFERRAL_COMPLETED',1,20,50,2,'ACTIVE','{}'::jsonb)
ON CONFLICT (mission_key) DO UPDATE SET title_key=EXCLUDED.title_key,description_key=EXCLUDED.description_key,target_type=EXCLUDED.target_type,target_value=EXCLUDED.target_value,credit_reward=EXCLUDED.credit_reward,xp_reward=EXCLUDED.xp_reward,status='ACTIVE',updated_at=NOW();