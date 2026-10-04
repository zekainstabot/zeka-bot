-- =========================================================
-- 145 - Simplify Admin Permissions
-- هر بخش فقط یک Permission اصلی دارد
-- =========================================================

-- ---------------------------------------------------------
-- 1. Permission های اصلی جدید
-- ---------------------------------------------------------

INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES
    ('users', 'کاربران', 'مشاهده و مدیریت کاربران'),
    ('settings', 'تنظیمات', 'مشاهده و مدیریت تنظیمات سیستم'),
    ('requests', 'درخواست‌ها', 'مشاهده و مدیریت درخواست‌های دانلود'),
    ('credits', 'اعتبارها', 'مشاهده و مدیریت اعتبار کاربران'),
    ('rewards', 'پاداش‌ها', 'مشاهده و مدیریت پاداش‌ها'),
    ('platforms', 'پلتفرم‌ها', 'مشاهده و مدیریت پلتفرم‌ها'),
    ('features', 'قابلیت‌ها', 'مشاهده و مدیریت قابلیت‌های سیستم'),
    ('support', 'پشتیبانی', 'مشاهده و مدیریت درخواست‌های پشتیبانی'),
    ('monitoring', 'مانیتورینگ', 'مشاهده وضعیت سیستم و خطاها'),
    ('admins', 'مدیران', 'مدیریت مدیران و سطح دسترسی'),
    ('reports', 'گزارش‌ها', 'مشاهده و مدیریت گزارش‌های کاربران'),
    ('games.quiz', 'مسابقه', 'مدیریت سؤالات مسابقه'),
    ('pro', 'Pro', 'فعال‌سازی و مدیریت Pro کاربران')
ON CONFLICT (permission_key) DO NOTHING;


-- ---------------------------------------------------------
-- 2. اتصال Permission های اصلی به Super Admin
-- ---------------------------------------------------------

INSERT INTO admin_role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.role_key = 'super_admin'
  AND p.permission_key IN (
      'users',
      'settings',
      'requests',
      'credits',
      'rewards',
      'platforms',
      'features',
      'support',
      'monitoring',
      'admins',
      'reports',
      'games.quiz',
      'pro'
  )
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------
-- 3. اتصال Permission های اصلی به Admin
-- ---------------------------------------------------------

INSERT INTO admin_role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
    ON p.permission_key IN (
        'users',
        'settings',
        'requests',
        'credits',
        'rewards',
        'platforms',
        'features',
        'support',
        'monitoring',
        'reports',
        'games.quiz'
    )
WHERE r.role_key = 'admin'
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------
-- 4. Permission های Support
-- ---------------------------------------------------------

INSERT INTO admin_role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
    ON p.permission_key IN (
        'users',
        'requests',
        'support'
    )
WHERE r.role_key = 'support'
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------
-- 5. حذف اتصال Permission های قدیمی از Roleها
-- ---------------------------------------------------------

DELETE FROM admin_role_permissions arp
USING admin_permissions p
WHERE arp.permission_id = p.id
  AND p.permission_key IN (
      'users.view',
      'users.manage',
      'settings.view',
      'settings.manage',
      'requests.view',
      'requests.manage',
      'credits.view',
      'credits.manage',
      'rewards.view',
      'rewards.manage',
      'platforms.view',
      'platforms.manage',
      'features.view',
      'features.manage',
      'support.view',
      'support.manage',
      'monitoring.view',
      'admins.view',
      'admins.manage',
      'reports.view',
      'reports.manage',
      'games.quiz.manage',
      'pro.manage'
  );


-- ---------------------------------------------------------
-- 6. حذف Override های Permission های قدیمی
-- ---------------------------------------------------------

DELETE FROM admin_user_permission_overrides ov
USING admin_permissions p
WHERE ov.permission_id = p.id
  AND p.permission_key IN (
      'users.view',
      'users.manage',
      'settings.view',
      'settings.manage',
      'requests.view',
      'requests.manage',
      'credits.view',
      'credits.manage',
      'rewards.view',
      'rewards.manage',
      'platforms.view',
      'platforms.manage',
      'features.view',
      'features.manage',
      'support.view',
      'support.manage',
      'monitoring.view',
      'admins.view',
      'admins.manage',
      'reports.view',
      'reports.manage',
      'games.quiz.manage',
      'pro.manage'
  );


-- ---------------------------------------------------------
-- 7. حذف Permission های قدیمی
-- ---------------------------------------------------------

DELETE FROM admin_permissions
WHERE permission_key IN (
    'users.view',
    'users.manage',
    'settings.view',
    'settings.manage',
    'requests.view',
    'requests.manage',
    'credits.view',
    'credits.manage',
    'rewards.view',
    'rewards.manage',
    'platforms.view',
    'platforms.manage',
    'features.view',
    'features.manage',
    'support.view',
    'support.manage',
    'monitoring.view',
    'admins.view',
    'admins.manage',
    'reports.view',
    'reports.manage',
    'games.quiz.manage',
    'pro.manage'
);
