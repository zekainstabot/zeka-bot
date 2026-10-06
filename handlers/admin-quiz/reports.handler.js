async function sendArchiveReports(
  ctx,
  telegramUserId,
  status,
  offset = 0
) {
  await requireReportViewPermission(
    telegramUserId
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  let reports;
  let total;

  if (status === "REVIEWED") {
    reports =
      await quizReportService.listReviewedArchive(
        telegramUserId,
        {
          limit: 1,
          offset: safeOffset,
        }
      );

    total =
      await quizReportService.countReviewedArchive(
        telegramUserId
      );
  } else {
    reports =
      await quizReportService.listReportsByStatus(
        telegramUserId,
        "UNREVIEWED",
        {
          limit: 1,
          offset: safeOffset,
        }
      );

    total =
      await quizReportService.countByStatus(
        telegramUserId,
        "UNREVIEWED"
      );
  }

  const title =
    status === "REVIEWED"
      ? "📚 آرشیو بررسی‌شده"
      : "🗃 آرشیو بررسی‌نشده";

  if (
    !reports ||
    reports.length === 0
  ) {
    await ctx.reply(
      `${title}\n\n` +
        "این آرشیو فعلاً خالی است.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "📂 بازگشت به آرشیوها",
            "quiz_admin_reports_archive"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 منوی مدیریت مسابقه",
            "quiz_admin_reports_back"
          ),
        ],
      ])
    );

    return;
  }

  const report = reports[0];

  const buttons = [];

  if (safeOffset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ قبلی",
        `quiz_admin_archive:${status}:${safeOffset - 1}`
      ),
    ]);
  }

  if (
    safeOffset + 1 <
    total
  ) {
    buttons.push([
      Markup.button.callback(
        "➡️ بعدی",
        `quiz_admin_archive:${status}:${safeOffset + 1}`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "👀 مشاهده سؤال",
      `quiz_admin_archive_view:${report.id}:${status}`
    ),
  ]);

  if (status === "UNREVIEWED") {
    buttons.push([
      Markup.button.callback(
        "✅ بررسی شد و انتقال به آرشیو بررسی‌شده",
        `quiz_admin_archive_review:${report.id}`
      ),
    ]);
  }

  if (status === "REVIEWED") {
    buttons.push([
      Markup.button.callback(
        "↩️ بازگرداندن به بررسی",
        `quiz_admin_archive_restore:${report.id}`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "🗑 حذف گزارش",
      `quiz_admin_archive_delete:${report.id}:${status}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "📂 آرشیوها",
      "quiz_admin_reports_archive"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔙 منوی مدیریت مسابقه",
      "quiz_admin_reports_back"
    ),
  ]);

  await ctx.reply(
    buildReportText(
      report,
      title
    ) +
      `\n\n📊 مورد ${
        safeOffset + 1
      } از ${total}`,
    Markup.inlineKeyboard(
      buttons
    )
  );
}
