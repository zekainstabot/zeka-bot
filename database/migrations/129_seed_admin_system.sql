INSERT INTO admin_roles
    (role_key, role_name, description)
VALUES
    ('super_admin', 'Super Admin', 'دسترسی کامل به تمام بخش‌های پنل مدیریت'),
    ('admin', 'Admin', 'دسترسی مدیریتی عمومی'),
    ('support', 'Support', 'دسترسی مربوط به پشتیبانی کاربران')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO admin_permissions
    (permission_key, permission_name, description)
VALUES
    ('users.view', 'مشاهده کاربران', 'مشاهده اطلاعات کاربران'),
    ('users.manage', 'مدیریت کاربران', 'مدیریت و تغییر وضعیت کاربران'),

    ('settings.view', 'مشاهده تنظیمات', 'مشاهده تنظیمات سیستم'),
    ('settings.manage', 'مدیریت تنظیمات', 'تغییر تنظیمات سیستم'),

    ('requests.view', 'مشاهده درخواست‌ها', 'مشاهده درخواست‌های دانلود'),
    ('requests.manage', 'مدیریت درخواست‌ها', 'مدیریت درخواست‌ها و صف'),

    ('credits.view', 'مشاهده اعتبارها', 'مشاهده اعتبار کاربران'),
    ('credits.manage', 'مدیریت اعتبارها', 'افزایش، کاهش و مدیریت اعتبار'),

    ('rewards.view', 'مشاهده پاداش‌ها', 'مشاهده سیستم پاداش'),
    ('rewards.manage', 'مدیریت پاداش‌ها', 'مدیریت پاداش‌ها'),

    ('platforms.view', 'مشاهده پلتفرم‌ها', 'مشاهده وضعیت پلتفرم‌ها'),
    ('platforms.manage', 'مدیریت پلتفرم‌ها', 'فعال و غیرفعال کردن پلتفرم‌ها'),

    ('features.view', 'مشاهده قابلیت‌ها', 'مشاهده قابلیت‌های سیستم'),
    ('features.manage', 'مدیریت قابلیت‌ها', 'فعال و غیرفعال کردن قابلیت‌ها'),

    ('support.view', 'مشاهده پشتیبانی', 'مشاهده درخواست‌های پشتیبانی'),
    ('support.manage', 'مدیریت پشتیبانی', 'مدیریت درخواست‌های پشتیبانی'),

    ('monitoring.view', 'مشاهده مانیتورینگ', 'مشاهده وضعیت سیستم و خطاها'),

    ('admins.view', 'مشاهده مدیران', 'مشاهده مدیران سیستم'),
    ('admins.manage', 'مدیریت مدیران', 'مدیریت مدیران و سطح دسترسی')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.role_key = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
    ON p.permission_key IN (
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
        'monitoring.view'
    )
WHERE r.role_key = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
    ON p.permission_key IN (
        'users.view',
        'requests.view',
        'support.view',
        'support.manage'
    )
WHERE r.role_key = 'support'
ON CONFLICT DO NOTHING;
