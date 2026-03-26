// =============================================================================
//  Nami Bot — Block Kit Message Builders
//  Shared module so slack-interactivity and slack-events can import these too.
// =============================================================================

const RATING_LABELS: Record<number, string> = {
  1: "Needs improvement",
  2: "Below expectations",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Exceptional",
};

// ---------------------------------------------------------------------------
//  Self-review opening
// ---------------------------------------------------------------------------
export function buildSelfReviewOpening(
  employeeName: string,
  cycleName: string,
  deadline: string,
  assignmentId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${employeeName}! :wave:\n\nYour performance review *${cycleName}* has kicked off. Time to reflect on your wins and growth areas.\n\n:calendar: Deadline: *${deadline}*`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Let's go :rocket:", emoji: true },
          style: "primary",
          action_id: "nami_start_review",
          value: `self_${assignmentId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: `self_${assignmentId}`,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Manager review opening (with context)
// ---------------------------------------------------------------------------
export function buildManagerReviewOpening(
  managerName: string,
  employeeName: string,
  cycleName: string,
  deadline: string,
  assignmentId: string,
  context: { selfAvg?: number; prevRating?: number; goalsCount?: number },
  ratingMax: number = 5,
) {
  const contextLines: string[] = [];
  if (context.selfAvg != null) {
    contextLines.push(
      `Self-Assessment avg: :star: *${(Math.round(context.selfAvg * 10) / 10).toString()}/${ratingMax}*`,
    );
  }
  if (context.prevRating != null) {
    contextLines.push(
      `Previous cycle rating: :star: *${(Math.round(context.prevRating * 10) / 10).toString()}/${ratingMax}*`,
    );
  }
  if (context.goalsCount != null && context.goalsCount > 0) {
    contextLines.push(`Active goals: *${context.goalsCount}*`);
  }

  const contextBlock =
    contextLines.length > 0
      ? `\n\n:bar_chart: *Quick context:*\n${contextLines.join("\n")}`
      : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${managerName}! :wave:\n\nIt's time to review *${employeeName}* for *${cycleName}*.\n:calendar: Deadline: *${deadline}*${contextBlock}`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Start review :pencil:", emoji: true },
          style: "primary",
          action_id: "nami_start_review",
          value: `mgr_${assignmentId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: `mgr_${assignmentId}`,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Upward feedback opening
// ---------------------------------------------------------------------------
export function buildUpwardFeedbackOpening(
  reviewerName: string,
  managerName: string,
  cycleName: string,
  deadline: string,
  assignmentId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${reviewerName}! :wave:\n\nYou've been invited to give upward feedback on *${managerName}* as part of *${cycleName}*.\n\n:lock: Your responses are *confidential* and will be aggregated before sharing.\n:calendar: Deadline: *${deadline}*`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "I'm ready :raised_hands:", emoji: true },
          style: "primary",
          action_id: "nami_start_review",
          value: `upward_${assignmentId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: `upward_${assignmentId}`,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Survey opening
// ---------------------------------------------------------------------------
export function buildSurveyOpening(
  userName: string,
  surveyName: string,
  questionCount: number,
  participantId: string,
  surveyId: string,
  role?: string,
  subjectName?: string,
) {
  const estMinutes = Math.max(1, Math.ceil(questionCount * 0.5));

  let roleContext = "";
  if (role === "self") {
    roleContext = "\n\n:mirror: This is a *self-review* — reflect on your own performance.";
  } else if (role === "manager" && subjectName) {
    roleContext = `\n\n:bust_in_silhouette: You're providing *manager feedback* for *${subjectName}*.`;
  } else if (role === "direct_report" && subjectName) {
    roleContext = `\n\n:speech_balloon: You're providing *upward feedback* for *${subjectName}*.`;
  } else if (role === "peer" && subjectName) {
    roleContext = `\n\n:handshake: You're providing *peer feedback* for *${subjectName}*.`;
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${userName}! :wave:\n\nYou've been invited to take the *${surveyName}* survey.${roleContext}\n\n:clipboard: *${questionCount}* questions \u00b7 ~${estMinutes} min`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":lock: Your responses are confidential and will be aggregated with others.",
        },
      ],
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Start survey :memo:", emoji: true },
          style: "primary",
          action_id: "nami_start_survey",
          value: JSON.stringify({ participantId, surveyId }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: `survey_${participantId}`,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Competency rating prompt (dynamic scale, splits into rows of 5 for Slack)
// ---------------------------------------------------------------------------
export function buildCompetencyPrompt(
  compName: string,
  compDesc: string,
  index: number,
  total: number,
  convId: string,
  assignmentId: string,
  ratingScale?: { min: number; max: number; labels: Record<number | string, string> },
) {
  const scale = ratingScale || { min: 1, max: 5, labels: RATING_LABELS };
  const buttons = [];
  for (let n = scale.min; n <= scale.max; n++) {
    buttons.push({
      type: "button" as const,
      text: { type: "plain_text" as const, text: `${n} - ${scale.labels[n] || ""}` },
      action_id: `nami_rate_${n}`,
      value: JSON.stringify({ convId, assignmentId, compName, rating: n }),
    });
  }

  // Split into action blocks of max 5 buttons each (Slack limit)
  const actionBlocks = [];
  for (let i = 0; i < buttons.length; i += 5) {
    actionBlocks.push({ type: "actions" as const, elements: buttons.slice(i, i + 5) });
  }

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:bar_chart: *${index + 1}/${total}: ${compName}*`,
      },
    },
  ];

  if (compDesc) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `📋 _${compDesc}_` }],
    });
  }

  blocks.push({ type: "divider" });
  blocks.push(...actionBlocks);

  return blocks;
}

// ---------------------------------------------------------------------------
//  Comment prompt after competency rating
// ---------------------------------------------------------------------------
export function buildCommentPrompt(compName: string, convId: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Any comments on *${compName}*?`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "✏️ Add Comment", emoji: true },
          action_id: "nami_open_comment_modal",
          value: JSON.stringify({ convId, compName }),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Skip" },
          action_id: "nami_skip_comment",
          value: JSON.stringify({ convId, compName }),
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Text question prompt (free-form)
// ---------------------------------------------------------------------------
export function buildTextQuestionPrompt(
  prompt: string,
  index: number,
  total: number,
  convId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:writing_hand: *Question ${index + 1}/${total}*\n${prompt}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Type your answer below. It will be captured automatically.",
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Review summary
// ---------------------------------------------------------------------------
export function buildReviewSummary(
  empName: string,
  compNames: string[],
  ratings: number[],
  textQuestions: string[],
  textResponses: string[],
  convId: string,
  ratingScale?: { min: number; max: number; labels: Record<number | string, string> },
) {
  const scale = ratingScale || { min: 1, max: 5, labels: RATING_LABELS };
  const scaleMax = scale.max;

  const lines = compNames.map((name, i) => {
    const r = ratings[i];
    const label = scale.labels[r] || "N/A";
    return `\u2022 *${name}*: ${r}/${scaleMax} (${label})`;
  });

  const textLines = textQuestions.map((q, i) => {
    const ans = textResponses[i] || "_no response_";
    return `\u2022 *${q}*\n  ${ans}`;
  });

  const avg =
    ratings.length > 0
      ? (Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10).toString()
      : "N/A";

  let summaryText = `:clipboard: *Review Summary for ${empName}*\nAverage rating: *${avg}/${scaleMax}*\n\n${lines.join("\n")}`;
  if (textLines.length > 0) {
    summaryText += `\n\n:writing_hand: *Open-ended responses:*\n${textLines.join("\n")}`;
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: summaryText },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Submit :white_check_mark:", emoji: true },
          style: "primary",
          action_id: "nami_submit_review",
          value: convId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit :pencil2:", emoji: true },
          action_id: "nami_edit_review",
          value: convId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cancel", emoji: true },
          style: "danger",
          action_id: "nami_cancel_review",
          value: convId,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Survey question prompt — handles rating_7, single_select, text
// ---------------------------------------------------------------------------
export function buildSurveyQuestionPrompt(
  question: {
    prompt: string;
    type: string;           // "rating_7" | "single_select" | "text"
    options?: string[];     // for single_select
  },
  index: number,
  total: number,
  convId: string,
  surveyId: string,
) {
  const header: any = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:clipboard: *Question ${index + 1}/${total}*\n${question.prompt}`,
    },
  };

  if (question.type === "rating_7") {
    const buttons = Array.from({ length: 7 }, (_, i) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: `${i + 1}` },
      action_id: `nami_survey_rate_${i + 1}`,
      value: JSON.stringify({ convId, surveyId, questionIndex: index, rating: i + 1 }),
    }));
    // Slack actions blocks have a max of 5 elements — split into two rows
    return [
      header,
      { type: "actions", elements: buttons.slice(0, 4) },
      { type: "actions", elements: buttons.slice(4) },
    ];
  }

  if (question.type === "single_select" && question.options) {
    const buttons = question.options.slice(0, 5).map((opt, i) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: opt },
      action_id: `nami_survey_select_${i}`,
      value: JSON.stringify({ convId, surveyId, questionIndex: index, selected: opt }),
    }));
    return [header, { type: "actions", elements: buttons }];
  }

  // text type — user types a response
  return [
    header,
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "Type your answer below." },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Skip" },
          action_id: "nami_survey_skip",
          value: JSON.stringify({ convId, surveyId, questionIndex: index }),
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Reminder message
// ---------------------------------------------------------------------------
export function buildReminderMessage(
  userName: string,
  itemName: string,
  reminderNum: number,
  daysLeft: number,
  actionValue: string,
  actionId: string,
) {
  const urgency =
    daysLeft <= 2
      ? ":rotating_light: Time is running out!"
      : daysLeft <= 5
        ? ":hourglass_flowing_sand: Don't leave it to the last minute!"
        : ":wave: Just a friendly nudge.";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${userName}! ${urgency}\n\nYou still have *${itemName}* to complete.\n:calendar: *${daysLeft <= 0 ? "overdue!" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}*`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Let's do it now :muscle:", emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind me later", emoji: true },
          action_id: "nami_remind_later",
          value: actionValue,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Manager escalation
// ---------------------------------------------------------------------------
export function buildManagerEscalation(
  mgrName: string,
  empName: string,
  itemName: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${mgrName} :wave:\n\n*${empName}* hasn't completed their *${itemName}* despite multiple reminders. You may want to follow up directly.`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "This is an automated escalation from Nami.",
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Final warning
// ---------------------------------------------------------------------------
export function buildFinalWarning(
  userName: string,
  itemName: string,
  actionValue: string,
  actionId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:rotating_light: *Final notice, ${userName}!*\n\nYour *${itemName}* is due *tomorrow*. Please complete it today to avoid missing the deadline.`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Complete now :zap:", emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Deadline reminder (7d, 3d, 1d before deadline)
// ---------------------------------------------------------------------------
export function buildDeadlineReminder(
  userName: string,
  itemName: string,
  daysLeft: number,
  actionValue: string,
  actionId: string,
) {
  const urgency =
    daysLeft <= 1
      ? ":rotating_light: Last call!"
      : daysLeft <= 3
        ? ":hourglass_flowing_sand: Getting close!"
        : ":wave: Heads up!";

  const dueText = daysLeft <= 1 ? "due tomorrow" : `due in ${daysLeft} days`;
  const buttonText = daysLeft <= 1 ? "Complete now :zap:" : "Let's do it :muscle:";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${userName}! ${urgency}\n\nYour *${itemName}* is *${dueText}*.`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: buttonText, emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Overdue notice (1+ day past deadline)
// ---------------------------------------------------------------------------
export function buildOverdueNotice(
  userName: string,
  itemName: string,
  actionValue: string,
  actionId: string,
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: Hey ${userName}, your *${itemName}* is now *overdue*.\n\nPlease complete ASAP — your team is counting on your input.`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Submit now :zap:", emoji: true },
          style: "primary",
          action_id: actionId,
          value: actionValue,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  Consolidated manager deadline alert
// ---------------------------------------------------------------------------
export function buildManagerDeadlineAlert(
  mgrName: string,
  reports: { name: string; itemName: string; status: string }[],
  isOverdue: boolean,
) {
  const emoji = isOverdue ? ":warning:" : ":wave:";
  const headline = isOverdue
    ? `${emoji} Hey ${mgrName}, the following team members have *overdue reviews*:`
    : `${emoji} Hey ${mgrName}, the following team members haven't completed reviews and the *deadline is tomorrow*:`;

  const bulletPoints = reports
    .map((r) => `• *${r.name}* — ${r.itemName} (${r.status})`)
    .join("\n");

  const footer = isOverdue
    ? "You may want to follow up directly to get these completed."
    : "A quick nudge might help them wrap up on time.";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${headline}\n\n${bulletPoints}\n\n${footer}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Automated alert from Nami.",
        },
      ],
    },
  ];
}
